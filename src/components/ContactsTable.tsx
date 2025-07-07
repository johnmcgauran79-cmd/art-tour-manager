
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useCustomers, useDeleteCustomer } from "@/hooks/useCustomers";
import { ContactTableRow } from "./ContactTableRow";
import { AddContactModal } from "./AddContactModal";
import { EditContactModal } from "./EditContactModal";

export const ContactsTable = () => {
  const { data: allCustomers, isLoading } = useCustomers();
  const deleteCustomerMutation = useDeleteCustomer();
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter all customers based on search query
  const filteredCustomers = (allCustomers || []).filter(customer => {
    if (!searchQuery.trim()) return true;
    const searchTerm = searchQuery.toLowerCase();
    
    return (
      customer.first_name?.toLowerCase().includes(searchTerm) ||
      customer.last_name?.toLowerCase().includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm) ||
      customer.phone?.toLowerCase().includes(searchTerm) ||
      customer.city?.toLowerCase().includes(searchTerm) ||
      customer.state?.toLowerCase().includes(searchTerm) ||
      customer.country?.toLowerCase().includes(searchTerm) ||
      customer.spouse_name?.toLowerCase().includes(searchTerm)
    );
  });

  const handleDeleteCustomer = (customer: any) => {
    if (confirm(`Are you sure you want to delete ${customer.first_name} ${customer.last_name}? This action cannot be undone.`)) {
      deleteCustomerMutation.mutate(customer.id);
    }
  };

  const handleContactClick = (customer: any) => {
    setEditingContact(customer);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading contacts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            All Contacts ({filteredCustomers.length} {searchQuery ? 'found' : 'total'})
            <Button onClick={() => setShowAddContact(true)} className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </CardTitle>
          <CardDescription>
            Search across all contacts in the system
          </CardDescription>
          <div className="flex items-center space-x-2 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, email, phone, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No contacts found matching your search." : "No contacts found."}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Spouse</TableHead>
                    <TableHead>Dietary Requirements</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <ContactTableRow
                      key={customer.id}
                      customer={customer}
                      onClick={handleContactClick}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddContactModal 
        open={showAddContact} 
        onOpenChange={setShowAddContact} 
      />

      {editingContact && (
        <EditContactModal
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
        />
      )}
    </>
  );
};
