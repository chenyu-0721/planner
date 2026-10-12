-- 預設管理員：admin / admin1111（請登入後修改密碼）
-- 其他使用者由管理員登入後在「使用者管理」建立
INSERT OR IGNORE INTO `users` (`username`, `password_hash`, `display_name`, `role`, `color`, `is_active`, `created_at`, `updated_at`)
VALUES ('admin', 'pbkdf2_sha256$100000$K3Dr6QCiqTJCPI+R0gQ6tQ==$HrgMB4y8rZ6tLvw32Bf+jV9BZpjWiylpbpQzl/jIKQ4=', '系統管理員', 'admin', '#0078d4', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
