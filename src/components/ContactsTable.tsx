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
import { ContactCard } from "./cards/ContactCard";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";

export const ContactsTable = () => {
  const { navigateWithContext } = useNavigationContext();
  const { isViewOnly, hasEditAccess } = usePermissions();
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
        <CardHeader className="space-y-4">
          {/* Title and buttons - stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg sm:text-xl">
              All Contacts ({totalCount.toLocaleString()})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setShowExport(true)} variant="outline" size="sm">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              {!isViewOnly && (
                <PermissionButton resource="contact" action="create" onClick={() => setShowImport(true)} variant="outline" size="sm">
                  <Upload className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Import</span>
                </PermissionButton>
              )}
              {!isViewOnly && (
                <PermissionButton resource="contact" action="create" onClick={() => setShowAddContact(true)} size="sm" className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Contact</span>
                </PermissionButton>
              )}
            </div>
          </div>
          
          <CardDescription className="text-xs sm:text-sm">
            Search across all {totalCount.toLocaleString()} contacts
          </CardDescription>
          
          {/* Search input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input 
                placeholder="Search name, email, phone..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-10 text-sm" 
              />
            </div>
            {searchQuery && (
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No contacts found matching your search." : "No contacts found."}
            </div> : <>
              {/* Mobile card view */}
              <div className="block md:hidden space-y-3">
                {customers.map(customer => (
                  <ContactCard 
                    key={customer.id} 
                    customer={customer} 
                    onClick={handleContactClick} 
                  />
                ))}
              </div>
              
              {/* Desktop table view */}
              <div className="hidden md:block border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">First Name</TableHead>
                      <TableHead className="min-w-[100px]">Last Name</TableHead>
                      <TableHead className="min-w-[150px]">Email</TableHead>
                      <TableHead className="min-w-[120px]">Phone</TableHead>
                      <TableHead className="min-w-[100px]">Spouse</TableHead>
                      <TableHead className="min-w-[120px]">Dietary</TableHead>
                      <TableHead className="min-w-[150px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map(customer => <ContactTableRow key={customer.id} customer={customer} onClick={handleContactClick} />)}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination - stacks on mobile */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  <span className="text-xs sm:text-sm whitespace-nowrap">
                    {currentPage} / {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                    disabled={currentPage === totalPages}
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
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