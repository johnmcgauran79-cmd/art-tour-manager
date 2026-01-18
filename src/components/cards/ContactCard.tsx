import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Eye } from "lucide-react";
import { formatAustralianMobile, Customer } from "@/hooks/useCustomers";
import { typography } from "@/lib/typography";
import { ContactAvatar } from "@/components/ContactAvatar";

interface ContactCardProps {
  customer: Customer;
  onClick?: (customer: Customer) => void;
}

export const ContactCard = ({ customer, onClick }: ContactCardProps) => {
  const displayPhone = formatAustralianMobile(customer.phone);

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => onClick?.(customer)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div onClick={(e) => e.stopPropagation()}>
              <ContactAvatar
                contactId={customer.id}
                avatarUrl={customer.avatar_url || null}
                firstName={customer.first_name}
                lastName={customer.last_name}
                editable={true}
                size="sm"
              />
            </div>
            <div className="min-w-0">
              <h3 className={`${typography.cardTitle} truncate`}>
                {customer.first_name} {customer.last_name}
              </h3>
              {customer.spouse_name && (
                <p className="text-xs text-muted-foreground truncate">
                  Spouse: {customer.spouse_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {customer.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
        )}

        {displayPhone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{displayPhone}</span>
          </div>
        )}

        {customer.dietary_requirements && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Dietary:</span>{" "}
            <span className="truncate">{customer.dietary_requirements}</span>
          </div>
        )}

        {customer.notes && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {customer.notes}
          </div>
        )}

        {onClick && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              onClick(customer);
            }}
          >
            <Eye className="h-4 w-4 mr-1.5" />
            View Details
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
