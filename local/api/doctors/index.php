<?php

declare(strict_types=1);

/**
 * Endpoint: /local/api/doctors/
 *
 * GET  ?action=getDoctors          — список врачей
 * POST ?action=updateDoctorStatus  — body: id=<int>&is_active=<0|1>
 *
 * Заголовок запроса:
 *   X-Telegram-Init-Data: <строка initData из Telegram.WebApp.initData>
 */

define('NO_KEEP_STATISTIC', true);
define('NOT_CHECK_PERMISSIONS', true);

require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/local/php_interface/lib/Api/AdminController.php';

\ClinicAdmin\Api\AdminController::handle();
