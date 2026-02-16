import { useState, useEffect, useCallback } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, ChevronLeft, ChevronRight, Upload, Download, Trash2 } from "lucide-react";
import { useCustomers, useDeleteCustomer, useBulkDeleteCustomers, BulkDeleteProgress } from "@/hooks/useCustomers";
import { ContactTableRow } from "./ContactTableRow";
import { AddContactModal } from "./AddContactModal";
import { ContactExportModal } from "./ContactExportModal";
import { ContactImportModal } from "./ContactImportModal";
import { ContactCard } from "./cards/ContactCard";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ContactsTable = () => {
  const { navigateWithContext } = useNavigationContext();
  const { isViewOnly, hasEditAccess, userRole } = usePermissions();
  const [showAddContact, setShowAddContact] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<BulkDeleteProgress | null>(null);
  const pageSize = 50;

  const isAdmin = userRole === 'admin';

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: customersData,
    isLoading
  } = useCustomers(currentPage, pageSize, debouncedSearch);
  const deleteCustomerMutation = useDeleteCustomer();
  const handleProgress = useCallback((p: BulkDeleteProgress) => setDeleteProgress(p), []);
  const bulkDeleteMutation = useBulkDeleteCustomers(handleProgress);

  const customers = customersData?.customers || [];
  const totalCount = customersData?.totalCount || 0;
  const totalPages = customersData?.totalPages || 1;

  // Clear selection when page or search changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, debouncedSearch]);

  const allOnPageSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const newSet = new Set(selectedIds);
      customers.forEach(c => newSet.delete(c.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      customers.forEach(c => newSet.add(c.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => {
    setDeleteProgress({ total: selectedIds.size, processed: 0, deleted: 0, skipped: 0 });
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
        setDeleteProgress(null);
      },
    });
  };

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg sm:text-xl">
              All Contacts ({totalCount.toLocaleString()})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && someSelected && (
                <Button 
                  onClick={() => setShowDeleteConfirm(true)} 
                  variant="destructive" 
                  size="sm"
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Delete ({selectedIds.size})</span>
                  <span className="sm:hidden">{selectedIds.size}</span>
                </Button>
              )}
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
                  <div key={customer.id} className="flex items-start gap-2">
                    {isAdmin && (
                      <div className="pt-4">
                        <Checkbox
                          checked={selectedIds.has(customer.id)}
                          onCheckedChange={() => toggleSelect(customer.id)}
                          aria-label={`Select ${customer.first_name} ${customer.last_name}`}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <ContactCard 
                        customer={customer} 
                        onClick={handleContactClick} 
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Desktop table view */}
              <div className="hidden md:block border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && (
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allOnPageSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all contacts on this page"
                          />
                        </TableHead>
                      )}
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
                    {customers.map(customer => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleContactClick(customer)}
                      >
                        {isAdmin && (
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(customer.id)}
                              onCheckedChange={() => toggleSelect(customer.id)}
                              aria-label={`Select ${customer.first_name} ${customer.last_name}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{customer.first_name}</TableCell>
                        <TableCell>{customer.last_name}</TableCell>
                        <TableCell>
                          {customer.email ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{customer.email}</span>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <span className="text-sm">{customer.phone}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{customer.spouse_name || "-"}</TableCell>
                        <TableCell>
                          <div className="max-w-[120px] truncate" title={customer.dietary_requirements || ""}>
                            {customer.dietary_requirements || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[150px] truncate" title={customer.notes || ""}>
                            {customer.notes || "-"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Select all on page indicator for mobile */}
              {isAdmin && customers.length > 0 && (
                <div className="flex items-center gap-2 mt-3 md:hidden">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all contacts on this page"
                  />
                  <span className="text-sm text-muted-foreground">Select all on this page</span>
                </div>
              )}
              
              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
                  {someSelected && ` · ${selectedIds.size} selected`}
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => {
        if (!bulkDeleteMutation.isPending) {
          setShowDeleteConfirm(open);
          if (!open) setDeleteProgress(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkDeleteMutation.isPending 
                ? "Deleting Contacts..." 
                : `Delete ${selectedIds.size} Contact${selectedIds.size !== 1 ? 's' : ''}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkDeleteMutation.isPending && deleteProgress ? (
                <div className="space-y-3 pt-2">
                  <Progress value={(deleteProgress.processed / deleteProgress.total) * 100} className="h-2" />
                  <div className="text-sm text-muted-foreground">
                    Processing {deleteProgress.processed} of {deleteProgress.total}
                    {deleteProgress.deleted > 0 && <span className="text-green-600 ml-2">· {deleteProgress.deleted} deleted</span>}
                    {deleteProgress.skipped > 0 && <span className="text-amber-600 ml-2">· {deleteProgress.skipped} skipped</span>}
                  </div>
                </div>
              ) : (
                <>
                  This will permanently delete {selectedIds.size} selected contact{selectedIds.size !== 1 ? 's' : ''}. 
                  Contacts with existing bookings will be skipped. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!bulkDeleteMutation.isPending && (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete {selectedIds.size} Contact{selectedIds.size !== 1 ? 's' : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <AddContactModal open={showAddContact} onOpenChange={setShowAddContact} />
      <ContactExportModal open={showExport} onOpenChange={setShowExport} searchQuery={debouncedSearch} filteredCount={totalCount} />
      <ContactImportModal open={showImport} onOpenChange={setShowImport} />
    </>;
};
