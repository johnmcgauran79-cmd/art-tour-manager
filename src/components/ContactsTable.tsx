
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, MapPin } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { AddContactModal } from "@/components/AddContactModal";
import { EditContactModal } from "@/components/EditContactModal";

export const ContactsTable = () => {
  const { data: customers, isLoading } = useCustomers();
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const handleContactClick = (contact: any) => {
    setSelectedContact(contact);
    setShowEditContact(true);
  };

  if (isLoading) {
    return <div>Loading contacts...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Contacts</CardTitle>
              <CardDescription>
                Complete list of all customer contacts
              </CardDescription>
            </div>
            <Button 
              onClick={() => setShowAddContact(true)}
              className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!customers || customers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No contacts found.</p>
              <Button 
                onClick={() => setShowAddContact(true)}
                className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
              >
                Add Your First Contact
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Surname</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Spouse</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Dietary Requirements</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow 
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleContactClick(customer)}
                  >
                    <TableCell className="font-medium">
                      {customer.first_name}
                    </TableCell>
                    <TableCell>
                      {customer.last_name}
                    </TableCell>
                    <TableCell>
                      {customer.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{customer.email}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{customer.phone}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.spouse_name || '-'}
                    </TableCell>
                    <TableCell>
                      {customer.state || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={customer.dietary_requirements || ''}>
                        {customer.dietary_requirements || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={customer.notes || ''}>
                        {customer.notes || '-'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddContactModal
        open={showAddContact}
        onOpenChange={setShowAddContact}
      />

      <EditContactModal
        contact={selectedContact}
        open={showEditContact}
        onOpenChange={setShowEditContact}
      />
    </>
  );
};
