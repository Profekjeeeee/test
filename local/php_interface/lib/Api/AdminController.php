<?php

declare(strict_types=1);

namespace ClinicAdmin\Api;

use Bitrix\Main\Config\Configuration;
use Bitrix\Main\Loader;
use Bitrix\Main\UserGroupTable;
use Bitrix\Main\UserTable;
use Bitrix\Highloadblock\HighloadBlockTable;
use CFile;
use RuntimeException;

/**
 * AdminController — управление врачами клиники через Telegram Mini App.
 *
 * Публичный API:
 *   validateAuth(string $initData): bool
 *   getDoctorsList(): array
 *   toggleDoctorStatus(int $id, int $status): array
 *
 * Конфигурация (/bitrix/.settings.php):
 *   'telegram' => [
 *       'value' => ['bot_token' => 'YOUR_BOT_TOKEN'],
 *   ],
 */
class AdminController
{
    /** Название Highload-блока (поле NAME, не TABLE_NAME). */
    private const HL_NAME = 'ClinicDoctors';

    /** ID группы «Администраторы» в стандартном Битриксе. */
    private const ADMIN_GROUP_ID = 1;

    // =========================================================================
    // Точка входа (вызывается из роутера doctors.php)
    // =========================================================================

    public static function handle(): void
    {
        self::setCorsHeaders();

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        header('Content-Type: application/json; charset=utf-8');

        // Читаем initData из заголовка запроса
        $initData = $_SERVER['HTTP_X_TELEGRAM_INIT_DATA'] ?? '';

        if (!self::validateAuth($initData)) {
            self::abort(403, 'Forbidden: invalid signature or insufficient privileges');
        }

        $action = $_POST['action'] ?? $_GET['action'] ?? '';

        try {
            match ($action) {
                'getDoctorsList' => self::json(
                    self::getDoctorsList()
                ),
                'toggleDoctorStatus' => self::json(
                    self::toggleDoctorStatus(
                        (int)($_POST['id']     ?? 0),
                        (int)($_POST['status'] ?? 0)
                    )
                ),
                default => self::abort(400, "Unknown action: $action"),
            };
        } catch (RuntimeException $e) {
            self::abort(500, $e->getMessage());
        }
    }

    // =========================================================================
    // БЕЗОПАСНОСТЬ
    // =========================================================================

    /**
     * Проверяет подлинность запроса от Telegram Mini App.
     *
     * Алгоритм (официальная документация Telegram):
     *   1. Убрать поле hash из initData.
     *   2. Отсортировать оставшиеся пары key=value по ключу (ksort).
     *   3. Собрать строку: "key1=val1\nkey2=val2\n..."
     *   4. secret_key = HMAC-SHA256(data = bot_token, key = "WebAppData")
     *   5. Вычислить HMAC-SHA256(data = строка, key = secret_key).
     *   6. Сравнить с hash из initData через hash_equals.
     *
     * После валидации хеша:
     *   - Ищет пользователя Битрикса с UF_TELEGRAM_ID = user.id из initData.
     *   - Проверяет, что пользователь активен.
     *   - Проверяет права: UF_IS_ADMIN = 1  ИЛИ  состоит в группе ID=1.
     *
     * @param string $initData  Строка Telegram.WebApp.initData
     * @return bool             true = доступ разрешён
     */
    public static function validateAuth(string $initData): bool
    {
        // ── 1. Базовые проверки ────────────────────────────────────────────
        if ($initData === '') {
            return false;
        }

        parse_str($initData, $params);

        $receivedHash = $params['hash'] ?? '';
        if ($receivedHash === '') {
            return false;
        }

        // ── 2. Формируем data-check-string ────────────────────────────────
        unset($params['hash']);
        ksort($params);

        $dataCheckString = implode(
            "\n",
            array_map(
                static fn(string $k, string $v): string => "$k=$v",
                array_keys($params),
                array_values($params)
            )
        );

        // ── 3. Вычисляем подпись ──────────────────────────────────────────
        // secret_key = HMAC-SHA256(data=bot_token, key="WebAppData")
        $secretKey    = hash_hmac('sha256', self::getBotToken(), 'WebAppData', true);
        // expected    = HMAC-SHA256(data=dataCheckString, key=secret_key)
        $expectedHash = hash_hmac('sha256', $dataCheckString, $secretKey);

        // hash_equals защищает от timing-атак
        if (!hash_equals($expectedHash, $receivedHash)) {
            return false;
        }

        // ── 4. Извлекаем Telegram user_id ─────────────────────────────────
        $telegramUserId = self::parseTelegramUserId($initData);
        if ($telegramUserId === null) {
            return false;
        }

        // ── 5. Ищем пользователя Битрикса по UF_TELEGRAM_ID ───────────────
        $bitrixUser = UserTable::getList([
            'filter' => [
                '=UF_TELEGRAM_ID' => (string)$telegramUserId,
                '=ACTIVE'         => 'Y',
            ],
            'select' => ['ID', 'UF_IS_ADMIN'],
            'limit'  => 1,
        ])->fetch();

        if (empty($bitrixUser)) {
            return false;
        }

        // ── 6. Проверка прав администратора ───────────────────────────────
        // Способ А: кастомное поле UF_IS_ADMIN (быстрее, без дополнительного запроса)
        if (!empty($bitrixUser['UF_IS_ADMIN'])) {
            return true;
        }

        // Способ Б: стандартная группа «Администраторы» (b_user_group)
        //   Используем UserGroupTable (D7), а не устаревший CUser::IsAdmin()
        $inAdminGroup = UserGroupTable::getList([
            'filter' => [
                '=USER_ID'  => (int)$bitrixUser['ID'],
                '=GROUP_ID' => self::ADMIN_GROUP_ID,
            ],
            'select' => ['USER_ID'],
            'limit'  => 1,
        ])->fetch();

        return !empty($inAdminGroup);
    }

    // =========================================================================
    // МЕТОДЫ API
    // =========================================================================

    /**
     * Возвращает список всех врачей из HL-блока ClinicDoctors.
     *
     * @return array{
     *   success: true,
     *   data: list<array{
     *     id: int,
     *     name: string,
     *     specialization: string,
     *     photo_url: string|null,
     *     is_active: bool,
     *     sort: int
     *   }>
     * }
     * @throws RuntimeException
     */
    public static function getDoctorsList(): array
    {
        Loader::includeModule('highloadblock');

        $entityClass = self::getHLEntityClass();

        $result = $entityClass::getList([
            'select' => [
                'ID',
                'UF_NAME',
                'UF_SPECIALIZATION',
                'UF_PHOTO',
                'UF_IS_ACTIVE',
                'UF_SORT',
            ],
            'order' => [
                'UF_SORT' => 'ASC',
                'ID'      => 'ASC',
            ],
        ]);

        $doctors = [];

        while ($row = $result->fetch()) {
            $doctors[] = [
                'id'             => (int)$row['ID'],
                'name'           => (string)$row['UF_NAME'],
                'specialization' => (string)$row['UF_SPECIALIZATION'],
                // CFile::GetPath() возвращает путь вида /upload/...
                // и не требует дополнительных запросов в отличие от GetByID()
                'photo_url'      => self::fileIdToUrl((int)($row['UF_PHOTO'] ?? 0)),
                'is_active'      => (bool)$row['UF_IS_ACTIVE'],
                'sort'           => (int)($row['UF_SORT'] ?? 100),
            ];
        }

        return [
            'success' => true,
            'data'    => $doctors,
        ];
    }

    /**
     * Переключает поле UF_IS_ACTIVE для врача с указанным ID.
     *
     * @param int $id      ID записи в HL-блоке
     * @param int $status  Новое значение: 1 = активен (виден в приложении), 0 = скрыт
     *
     * @return array{success: bool, id?: int, is_active?: int, error?: string}
     * @throws RuntimeException
     */
    public static function toggleDoctorStatus(int $id, int $status): array
    {
        if ($id <= 0) {
            return [
                'success' => false,
                'error'   => 'Doctor ID must be a positive integer',
            ];
        }

        // Принимаем только 0 или 1 — защита от мусора в параметрах
        $normalizedStatus = $status !== 0 ? 1 : 0;

        Loader::includeModule('highloadblock');

        $entityClass = self::getHLEntityClass();

        // Убеждаемся, что запись существует перед обновлением
        $exists = $entityClass::getList([
            'filter' => ['=ID' => $id],
            'select' => ['ID'],
            'limit'  => 1,
        ])->fetch();

        if (empty($exists)) {
            return [
                'success' => false,
                'error'   => "Doctor with ID=$id not found",
            ];
        }

        $updateResult = $entityClass::update($id, [
            'UF_IS_ACTIVE' => $normalizedStatus,
        ]);

        if ($updateResult->isSuccess()) {
            return [
                'success'   => true,
                'id'        => $id,
                'is_active' => $normalizedStatus,
            ];
        }

        return [
            'success' => false,
            'error'   => implode('; ', $updateResult->getErrorMessages()),
        ];
    }

    // =========================================================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // =========================================================================

    /**
     * Читает bot_token из секции 'telegram' в /bitrix/.settings.php.
     *
     * Пример конфигурации:
     *   'telegram' => [
     *       'value' => [
     *           'bot_token' => '123456:ABC-DEF...',
     *       ],
     *   ],
     *
     * @throws RuntimeException если токен не задан
     */
    private static function getBotToken(): string
    {
        $config   = Configuration::getInstance()->get('telegram');
        $botToken = $config['bot_token'] ?? '';

        if ($botToken === '') {
            throw new RuntimeException(
                'BOT_TOKEN not configured. '
                . 'Add section "telegram" => ["value" => ["bot_token" => "..."]] '
                . 'to /bitrix/.settings.php'
            );
        }

        return $botToken;
    }

    /**
     * Парсит числовой user.id из поля user в строке initData.
     *
     * initData содержит URL-encoded параметры, среди которых:
     *   user={"id":123456789,"first_name":"Ivan",...}
     */
    private static function parseTelegramUserId(string $initData): ?int
    {
        parse_str($initData, $params);

        if (empty($params['user'])) {
            return null;
        }

        $user = json_decode($params['user'], true);

        if (!is_array($user) || !isset($user['id'])) {
            return null;
        }

        return (int)$user['id'];
    }

    /**
     * Компилирует и возвращает класс ORM для HL-блока ClinicDoctors.
     *
     * @throws RuntimeException если блок не найден в базе
     */
    private static function getHLEntityClass(): string
    {
        $hlblock = HighloadBlockTable::getList([
            'filter' => ['=NAME' => self::HL_NAME],
            'limit'  => 1,
        ])->fetch();

        if (!$hlblock) {
            throw new RuntimeException(
                'Highload-block "' . self::HL_NAME . '" not found. '
                . 'Please run install_hl_doctors.php first.'
            );
        }

        return HighloadBlockTable::compileEntity($hlblock)->getDataClass();
    }

    /**
     * Преобразует ID файла из b_file в полный URL через CFile::GetPath().
     *
     * CFile::GetPath() предпочтительнее GetByID()->Fetch():
     *   - один SELECT вместо двух
     *   - возвращает путь вида /upload/iblock/abc/photo.jpg
     *
     * @param int $fileId  ID файла (поле UF_PHOTO)
     * @return string|null Абсолютный URL или null, если файл не найден
     */
    private static function fileIdToUrl(int $fileId): ?string
    {
        if ($fileId <= 0) {
            return null;
        }

        $relativePath = CFile::GetPath($fileId);

        if (empty($relativePath)) {
            return null;
        }

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            ? 'https'
            : 'http';

        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '') . $relativePath;
    }

    /**
     * Устанавливает CORS-заголовки для работы с Telegram Web App.
     * Telegram открывает Mini App внутри iframe web.telegram.org.
     */
    private static function setCorsHeaders(): void
    {
        header('Access-Control-Allow-Origin: https://web.telegram.org');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Telegram-Init-Data');
        header('Access-Control-Max-Age: 3600');
    }

    /**
     * Отправляет массив как JSON-ответ и завершает выполнение.
     */
    private static function json(array $data): void
    {
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * Отправляет JSON-ошибку с нужным HTTP-статусом и завершает выполнение.
     */
    private static function abort(int $httpCode, string $message): never
    {
        http_response_code($httpCode);
        echo json_encode(
            ['success' => false, 'error' => $message],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
}
