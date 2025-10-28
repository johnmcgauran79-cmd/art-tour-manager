import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface AppBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const AppBreadcrumbs = ({ items, className }: AppBreadcrumbsProps) => {
  if (items.length === 0) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <span key={index} className="flex items-center">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="max-w-[200px] truncate" title={item.label}>
                    {item.label}
                  </BreadcrumbPage>
                ) : item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className="transition-colors hover:text-foreground max-w-[200px] truncate"
                    title={item.label}
                  >
                    {item.label}
                  </button>
                ) : item.href ? (
                  <BreadcrumbLink asChild>
                    <Link
                      to={item.href}
                      className="max-w-[200px] truncate"
                      title={item.label}
                    >
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground max-w-[200px] truncate" title={item.label}>
                    {item.label}
                  </span>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
