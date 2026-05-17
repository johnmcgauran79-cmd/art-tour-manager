UPDATE public.email_templates
SET content_template = replace(
  content_template,
  '<p class="ql-align-center"><a href="{{combined_report_link}}" rel="noopener noreferrer" target="_blank" style="background-color: rgb(26, 26, 26); color: rgb(255, 255, 255);">View Combined Host Report</a></p>',
  '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 24px auto;"><tr><td align="center" style="background-color: #1a2332; border-radius: 6px;"><a href="{{combined_report_link}}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 6px;">View Combined Host Report</a></td></tr></table>'
)
WHERE type = 'host_pre_tour_briefing';