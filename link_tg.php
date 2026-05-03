<?php
// Подключаем ядро Битрикса
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");

use Bitrix\Main\UserTable;

// 1. Твой ID в Битриксе (на скриншоте был 1)
$userId = 1; 

// 2. ВСТАВЬ СВОЙ ID ИЗ @userinfobot НИЖЕ
$telegramId = "264358109"; 

if (empty($telegramId) || $telegramId == "264358109") {
    die("Ошибка: Сначала впиши свой Telegram ID в код файла!");
}

$user = new CUser;
$fields = ["UF_TELEGRAM_ID" => $telegramId];

if ($user->Update($userId, $fields)) {
    echo "Успех! Telegram ID " . $telegramId . " привязан к пользователю " . $userId . ".";
    echo "<br>Теперь можешь удалять этот файл с сервера.";
} else {
    echo "Ошибка обновления: " . $user->LAST_ERROR;
}