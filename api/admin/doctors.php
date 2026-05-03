<?php

declare(strict_types=1);

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Роутер API: /api/admin/doctors.php                                     ║
 * ║  Telegram Mini App — раздел «Управление врачами»                        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  МЕТОДЫ                                                                 ║
 * ║                                                                         ║
 * ║  GET  ?action=getDoctorsList                                            ║
 * ║    → { success: true, data: [ DoctorItem, ... ] }                      ║
 * ║                                                                         ║
 * ║  POST action=toggleDoctorStatus  +  id=<int>  +  status=<0|1>          ║
 * ║    → { success: true, id: <int>, is_active: <0|1> }                    ║
 * ║    → { success: false, error: "..." }                                   ║
 * ║                                                                         ║
 * ║  DoctorItem:                                                            ║
 * ║  {                                                                      ║
 * ║    id:             number,                                              ║
 * ║    name:           string,   // UF_NAME                                 ║
 * ║    specialization: string,   // UF_SPECIALIZATION                       ║
 * ║    photo_url:      string|null,                                         ║
 * ║    is_active:      boolean,  // UF_IS_ACTIVE                            ║
 * ║    sort:           number,   // UF_SORT                                 ║
 * ║  }                                                                      ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ЗАГОЛОВОК КАЖДОГО ЗАПРОСА (обязательно):                               ║
 * ║    X-Telegram-Init-Data: <Telegram.WebApp.initData>                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  JS-ПРИМЕР ДЛЯ ФРОНТЕНДА (Telegram Mini App)                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * const API_URL = 'https://your-domain.ru/api/admin/doctors.php';
 *
 * // Общий хелпер: добавляет initData в заголовки автоматически
 * async function apiRequest(action, postData = null) {
 *   const headers = {
 *     'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
 *   };
 *
 *   if (postData) {
 *     // POST-запрос
 *     headers['Content-Type'] = 'application/x-www-form-urlencoded';
 *     const body = new URLSearchParams({ action, ...postData });
 *     const res = await fetch(API_URL, { method: 'POST', headers, body });
 *     return res.json();
 *   } else {
 *     // GET-запрос
 *     const res = await fetch(`${API_URL}?action=${action}`, { headers });
 *     return res.json();
 *   }
 * }
 *
 * // ── Получить список врачей ─────────────────────────────────────────────
 * async function loadDoctors() {
 *   const { success, data, error } = await apiRequest('getDoctorsList');
 *
 *   if (!success) {
 *     console.error('Ошибка загрузки врачей:', error);
 *     return;
 *   }
 *
 *   // data — массив объектов DoctorItem
 *   data.forEach(doctor => {
 *     console.log(`${doctor.name} (${doctor.specialization}) — ${doctor.is_active ? 'активен' : 'скрыт'}`);
 *   });
 * }
 *
 * // ── Переключить статус врача ───────────────────────────────────────────
 * async function toggleDoctor(doctorId, currentStatus) {
 *   const newStatus = currentStatus ? 0 : 1;   // инвертируем
 *
 *   const { success, is_active, error } = await apiRequest(
 *     'toggleDoctorStatus',
 *     { id: String(doctorId), status: String(newStatus) }
 *   );
 *
 *   if (success) {
 *     // Haptic feedback: лёгкий — включение, средний — выключение
 *     window.Telegram.WebApp.HapticFeedback.impactOccurred(
 *       is_active ? 'light' : 'medium'
 *     );
 *     updateToggleUI(doctorId, is_active);
 *   } else {
 *     window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
 *     console.error('Ошибка переключения:', error);
 *   }
 * }
 *
 * // Функция обновления UI переключателя (пример)
 * function updateToggleUI(doctorId, isActive) {
 *   const toggle = document.querySelector(`[data-doctor-id="${doctorId}"] .toggle`);
 *   if (toggle) toggle.classList.toggle('active', Boolean(isActive));
 * }
 */

// ── Инициализация Битрикса ────────────────────────────────────────────────

// Не записываем статистику посещений (ускоряет ответ на ~20ms)
define('NO_KEEP_STATISTIC', true);

// Пропускаем стандартную проверку прав Битрикса — используем собственную авторизацию
define('NOT_CHECK_PERMISSIONS', true);

// Ядро Битрикса
require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';

// Контроллер
require_once $_SERVER['DOCUMENT_ROOT'] . '/local/php_interface/lib/Api/AdminController.php';

// ── Запуск ────────────────────────────────────────────────────────────────

\ClinicAdmin\Api\AdminController::handle();
