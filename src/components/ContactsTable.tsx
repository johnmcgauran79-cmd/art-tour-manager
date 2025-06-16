
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Upload, PhoneCall, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useCustomers, useBulkUpdatePhoneNumbers } from "@/hooks/useCustomers";
import { AddContactModal } from "@/components/AddContactModal";
import { EditContactModal } from "@/components/EditContactModal";
import { CSVUploadModal } from "@/components/CSVUploadModal";
import { ContactsTableContent } from "./ContactsTableContent";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

const CONTACTS_PER_PAGE = 100;

export const ContactsTable = () => {
  const { data: customers, isLoading } = useCustomers();
  const bulkUpdatePhones = useBulkUpdatePhoneNumbers();
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasUnformattedPhones, setHasUnformattedPhones] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handleContactClick = (contact: any) => {
    setSelectedContact(contact);
    setShowEditContact(true);
  };

  // Detect if any AU mobile numbers need formatting (9 digits, starts with 4)
  useEffect(() => {
    if (customers) {
      const needsFormatting = customers.some((customer) => {
        if (!customer.phone) return false;
        const digitsOnly = customer.phone.replace(/\D/g, "");
        return digitsOnly.length === 9 && digitsOnly.startsWith("4");
      });
      setHasUnformattedPhones(needsFormatting);
    }
  }, [customers]);

  const handleBulkPhoneUpdate = () => {
    if (customers) {
      bulkUpdatePhones.mutate(customers);
    }
  };

  // Filter customers by search - check all relevant fields
  const filteredCustomers =
    customers?.filter((customer) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        customer.first_name?.toLowerCase().includes(searchLower) ||
        customer.last_name?.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.phone?.toLowerCase().includes(searchLower) ||
        customer.city?.toLowerCase().includes(searchLower) ||
        customer.state?.toLowerCase().includes(searchLower)
      );
    }) || [];

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate pagination
  const totalContacts = filteredCustomers.length;
  const totalPages = Math.ceil(totalContacts / CONTACTS_PER_PAGE);
  const startIndex = (currentPage - 1) * CONTACTS_PER_PAGE;
  const endIndex = startIndex + CONTACTS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSelect = (value: string) => {
    const page = parseInt(value);
    handlePageChange(page);
  };

  // Generate page numbers to show (show current page and surrounding pages)
  const getVisiblePages = () => {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    // Adjust start if we're near the end
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  console.log(`Total customers from API: ${customers?.length || 0}`);
  console.log(`Filtered customers: ${filteredCustomers.length}`);
  console.log(`Current page: ${currentPage}, Total pages: ${totalPages}`);

  if (isLoading) {
    return <div>Loading contacts...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
                {searchTerm ? `${totalContacts} Contacts Found` : `All ${customers?.length || 0} Contacts`}
              </CardTitle>
              <CardDescription>
                {searchTerm 
                  ? `Showing ${paginatedCustomers.length} of ${totalContacts} matching contacts`
                  : `Showing ${paginatedCustomers.length} of ${totalContacts} contacts (page ${currentPage} of ${totalPages})`
                }
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
              placeholder="Search by name, email, phone, city, or state..."
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
          ) : totalContacts === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No contacts match your search.</p>
            </div>
          ) : (
            <>
              <ContactsTableContent
                customers={paginatedCustomers}
                onContactClick={handleContactClick}
              />
              {totalPages > 1 && (
                <div className="mt-4 space-y-4">
                  {/* Page selector dropdown */}
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Go to page:</span>
                      <Select value={currentPage.toString()} onValueChange={handlePageSelect}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <SelectItem key={page} value={page.toString()}>
                              {page}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">of {totalPages}</span>
                    </div>
                  </div>

                  {/* Pagination controls */}
                  <Pagination>
                    <PaginationContent>
                      {/* First page button */}
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(1)}
                          disabled={currentPage === 1}
                          className="gap-1"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                          First
                        </Button>
                      </PaginationItem>
                      
                      {/* Previous button */}
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) handlePageChange(currentPage - 1);
                          }}
                          className={currentPage === 1 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {/* Page numbers */}
                      {getVisiblePages().map((pageNumber) => (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(pageNumber);
                            }}
                            isActive={currentPage === pageNumber}
                            className="cursor-pointer"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      {/* Next button */}
                      <PaginationItem>
                        <PaginationNext 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) handlePageChange(currentPage + 1);
                          }}
                          className={currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        />
                      </PaginationItem>

                      {/* Last page button */}
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(totalPages)}
                          disabled={currentPage === totalPages}
                          className="gap-1"
                        >
                          Last
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AddContactModal open={showAddContact} onOpenChange={setShowAddContact} />
      <EditContactModal
        contact={selectedContact}
        open={showEditContact}
        onOpenChange={setShowEditContact}
      />
      <CSVUploadModal open={showCSVUpload} onOpenChange={setShowCSVUpload} />
    </>
  );
};
