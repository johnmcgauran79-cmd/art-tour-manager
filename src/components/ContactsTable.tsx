
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Mail, Phone, Search, Upload, PhoneCall } from "lucide-react";
import { useCustomers, useBulkUpdatePhoneNumbers, formatAustralianMobile } from "@/hooks/useCustomers";
import { AddContactModal } from "@/components/AddContactModal";
import { EditContactModal } from "@/components/EditContactModal";
import { CSVUploadModal } from "@/components/CSVUploadModal";

export const ContactsTable = () => {
  const { data: customers, isLoading } = useCustomers();
  const bulkUpdatePhones = useBulkUpdatePhoneNumbers();
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasUnformattedPhones, setHasUnformattedPhones] = useState(false);

  const handleContactClick = (contact: any) => {
    setSelectedContact(contact);
    setShowEditContact(true);
  };

  // Check for unformatted Australian mobile numbers
  useEffect(() => {
    if (customers) {
      const needsFormatting = customers.some(customer => {
        if (!customer.phone) return false;
        const digitsOnly = customer.phone.replace(/\D/g, '');
        return digitsOnly.length === 9 && digitsOnly.startsWith('4');
      });
      setHasUnformattedPhones(needsFormatting);
    }
  }, [customers]);

  const handleBulkPhoneUpdate = () => {
    if (customers) {
      bulkUpdatePhones.mutate(customers);
    }
  };

  // Filter customers based on search term
  const filteredCustomers = customers?.filter(customer => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.first_name?.toLowerCase().includes(searchLower) ||
      customer.last_name?.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const totalContacts = customers?.length || 0;

  if (isLoading) {
    return <div>Loading contacts...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All {totalContacts} Contacts</CardTitle>
              <CardDescription>
                Complete list of all customer contacts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {hasUnformattedPhones && (
                <Button 
                  onClick={handleBulkPhoneUpdate}
                  disabled={bulkUpdatePhones.isPending}
                  variant="outline"
                  className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                >
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Format AU Numbers
                </Button>
              )}
              <Button 
                onClick={() => setShowCSVUpload(true)}
                variant="outline"
                className="border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-brand-yellow"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button 
                onClick={() => setShowAddContact(true)}
                className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by first name, surname, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!customers || customers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No contacts found.</p>
              <div className="flex justify-center gap-2">
                <Button 
                  onClick={() => setShowCSVUpload(true)}
                  variant="outline"
                  className="border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-brand-yellow"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import from CSV
                </Button>
                <Button 
                  onClick={() => setShowAddContact(true)}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                >
                  Add Your First Contact
                </Button>
              </div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No contacts match your search.</p>
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
                {filteredCustomers.map((customer) => {
                  // Format phone number for display
                  const displayPhone = formatAustralianMobile(customer.phone);
                  const phoneChanged = displayPhone !== customer.phone;
                  
                  return (
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
                        {displayPhone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className={`text-sm ${phoneChanged ? 'text-blue-600 font-medium' : ''}`}>
                              {displayPhone}
                            </span>
                            {phoneChanged && (
                              <span className="text-xs text-muted-foreground">(formatted)</span>
                            )}
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
                  );
                })}
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

      <CSVUploadModal
        open={showCSVUpload}
        onOpenChange={setShowCSVUpload}
      />
    </>
  );
};
