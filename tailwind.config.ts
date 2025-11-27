
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				brand: {
					navy: 'hsl(var(--brand-navy))',
					yellow: 'hsl(var(--brand-yellow))',
					gold: 'hsl(var(--brand-gold))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				error: {
					DEFAULT: 'hsl(var(--error))',
					foreground: 'hsl(var(--error-foreground))'
				},
				status: {
					pending: 'hsl(var(--status-pending))',
					'pending-foreground': 'hsl(var(--status-pending-foreground))',
					invoiced: 'hsl(var(--status-invoiced))',
					'invoiced-foreground': 'hsl(var(--status-invoiced-foreground))',
					deposited: 'hsl(var(--status-deposited))',
					'deposited-foreground': 'hsl(var(--status-deposited-foreground))',
					'instalment-paid': 'hsl(var(--status-instalment-paid))',
					'instalment-paid-foreground': 'hsl(var(--status-instalment-paid-foreground))',
					'fully-paid': 'hsl(var(--status-fully-paid))',
					'fully-paid-foreground': 'hsl(var(--status-fully-paid-foreground))',
					cancelled: 'hsl(var(--status-cancelled))',
					'cancelled-foreground': 'hsl(var(--status-cancelled-foreground))',
					waitlisted: 'hsl(var(--status-waitlisted))',
					'waitlisted-foreground': 'hsl(var(--status-waitlisted-foreground))',
					available: 'hsl(var(--status-available))',
					'available-foreground': 'hsl(var(--status-available-foreground))',
					'limited-availability': 'hsl(var(--status-limited-availability))',
					'limited-availability-foreground': 'hsl(var(--status-limited-availability-foreground))',
					'sold-out': 'hsl(var(--status-sold-out))',
					'sold-out-foreground': 'hsl(var(--status-sold-out-foreground))',
					closed: 'hsl(var(--status-closed))',
					'closed-foreground': 'hsl(var(--status-closed-foreground))',
					past: 'hsl(var(--status-past))',
					'past-foreground': 'hsl(var(--status-past-foreground))',
					todo: 'hsl(var(--status-todo))',
					'todo-foreground': 'hsl(var(--status-todo-foreground))',
					'in-progress': 'hsl(var(--status-in-progress))',
					'in-progress-foreground': 'hsl(var(--status-in-progress-foreground))',
					waiting: 'hsl(var(--status-waiting))',
					'waiting-foreground': 'hsl(var(--status-waiting-foreground))',
					completed: 'hsl(var(--status-completed))',
					'completed-foreground': 'hsl(var(--status-completed-foreground))',
					archived: 'hsl(var(--status-archived))',
					'archived-foreground': 'hsl(var(--status-archived-foreground))',
				},
				priority: {
					low: 'hsl(var(--priority-low))',
					'low-foreground': 'hsl(var(--priority-low-foreground))',
					medium: 'hsl(var(--priority-medium))',
					'medium-foreground': 'hsl(var(--priority-medium-foreground))',
					high: 'hsl(var(--priority-high))',
					'high-foreground': 'hsl(var(--priority-high-foreground))',
					critical: 'hsl(var(--priority-critical))',
					'critical-foreground': 'hsl(var(--priority-critical-foreground))',
				}
			},
			fontSize: {
				'xs': 'var(--font-size-xs)',
				'sm': 'var(--font-size-sm)',
				'base': 'var(--font-size-base)',
				'lg': 'var(--font-size-lg)',
				'xl': 'var(--font-size-xl)',
				'2xl': 'var(--font-size-2xl)',
				'3xl': 'var(--font-size-3xl)',
				'4xl': 'var(--font-size-4xl)'
			},
			fontWeight: {
				'light': 'var(--font-weight-light)',
				'normal': 'var(--font-weight-normal)',
				'medium': 'var(--font-weight-medium)',
				'semibold': 'var(--font-weight-semibold)',
				'bold': 'var(--font-weight-bold)',
				'extrabold': 'var(--font-weight-extrabold)'
			},
			lineHeight: {
				'tight': 'var(--line-height-tight)',
				'snug': 'var(--line-height-snug)',
				'normal': 'var(--line-height-normal)',
				'relaxed': 'var(--line-height-relaxed)',
				'loose': 'var(--line-height-loose)'
			},
			spacing: {
				'1': 'var(--space-1)',
				'2': 'var(--space-2)',
				'3': 'var(--space-3)',
				'4': 'var(--space-4)',
				'5': 'var(--space-5)',
				'6': 'var(--space-6)',
				'8': 'var(--space-8)',
				'10': 'var(--space-10)',
				'12': 'var(--space-12)',
				'16': 'var(--space-16)',
				'20': 'var(--space-20)',
				'24': 'var(--space-24)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
