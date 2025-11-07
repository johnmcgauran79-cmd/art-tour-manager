import { useState, useEffect } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronLeft, ChevronRight, Upload, Download } from "lucide-react";
import { useCustomers, useDeleteCustomer } from "@/hooks/useCustomers";
import { ContactTableRow } from "./ContactTableRow";
import { AddContactModal } from "./AddContactModal";
import { ContactExportModal } from "./ContactExportModal";
import { ContactImportModal } from "./ContactImportModal";
export const ContactsTable = () => {
  const { navigateWithContext } = useNavigationContext();
  const [showAddContact, setShowAddContact] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page when searching
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const {
    data: customersData,
    isLoading
  } = useCustomers(currentPage, pageSize, debouncedSearch);
  const deleteCustomerMutation = useDeleteCustomer();
  const customers = customersData?.customers || [];
  const totalCount = customersData?.totalCount || 0;
  const totalPages = customersData?.totalPages || 1;
  const handleDeleteCustomer = (customer: any) => {
    if (confirm(`Are you sure you want to delete ${customer.first_name} ${customer.last_name}? This action cannot be undone.`)) {
      deleteCustomerMutation.mutate(customer.id);
    }
  };
  const handleContactClick = (customer: any) => {
    navigateWithContext(`/contacts/${customer.id}`);
  };
  if (isLoading) {
    return <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading contacts...</div>
        </CardContent>
      </Card>;
  }
  return <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            All Contacts ({totalCount.toLocaleString()} total)
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowExport(true)} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setShowImport(true)} variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setShowAddContact(true)} className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Search across all {totalCount.toLocaleString()} contacts in the database
          </CardDescription>
          <div className="flex items-center space-x-2 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search by name, email, phone, location..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            {searchQuery && <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear
              </Button>}
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No contacts found matching your search." : "No contacts found."}
            </div> : <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Spouse</TableHead>
                      <TableHead>Dietary Requirement</TableHead>
                      <TableHead>Dietary Requirements</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map(customer => <ContactTableRow key={customer.id} customer={customer} onClick={handleContactClick} />)}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} contacts
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>}
        </CardContent>
      </Card>

      <AddContactModal open={showAddContact} onOpenChange={setShowAddContact} />

      <ContactExportModal open={showExport} onOpenChange={setShowExport} searchQuery={debouncedSearch} filteredCount={totalCount} />

      <ContactImportModal open={showImport} onOpenChange={setShowImport} />
    </>;
};