import { useState } from "react"
import { useLocation } from "react-router-dom"
import { AppSidebar } from "./AppSidebar"
import { 
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage
} from "@/components/ui/breadcrumb"

interface LayoutProps {
  children: React.ReactNode
}

const breadcrumbMap: Record<string, string[]> = {
  "/": ["Dashboard"],
  "/tours": ["Dashboard", "Tours"],
  "/bookings": ["Dashboard", "Bookings"],
  "/contacts": ["Dashboard", "Contacts"],
  "/hotels": ["Dashboard", "Hotels"],
  "/activities": ["Dashboard", "Activities"],
  "/tasks": ["Dashboard", "Tasks"],
  "/reports": ["Dashboard", "Reports"],
  "/notifications": ["Dashboard", "Notifications"],
  "/settings": ["Dashboard", "Settings"],
}

export function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()

  const breadcrumbs = breadcrumbMap[location.pathname] || ["Dashboard"]

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with breadcrumbs */}
        <header className="border-b border-border bg-background px-6 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage>{crumb}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink 
                        href={index === 0 ? "/" : `/${crumb.toLowerCase()}`}
                      >
                        {crumb}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}