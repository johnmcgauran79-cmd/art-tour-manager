
-- Insert theme/appearance settings with current defaults
INSERT INTO general_settings (setting_key, setting_value, description) VALUES
  ('theme_primary_color', '"#0a1929"', 'Primary brand color (dark navy) - used for buttons, headers, sidebar'),
  ('theme_secondary_color', '"#d4a017"', 'Secondary/accent color (gold) - used for highlights, active states, links'),
  ('theme_sidebar_bg', '"#fafafa"', 'Sidebar background color'),
  ('theme_sidebar_text', '"#0a1929"', 'Sidebar text color'),
  ('theme_email_button_color', '"#0a1929"', 'Email CTA button background color'),
  ('theme_email_button_text', '"#d4a017"', 'Email CTA button text color'),
  ('theme_email_accent_color', '"#d4a017"', 'Email accent/highlight color')
ON CONFLICT DO NOTHING;
