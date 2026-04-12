INSERT INTO general_settings (setting_key, setting_value, description)
VALUES ('max_additional_info_blocks', '5', 'Maximum number of additional information blocks to include in emails')
ON CONFLICT DO NOTHING;