import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomerAnalytics, useCustomerLifetimeStats, CustomerAnalytics } from "@/hooks/useCustomerAnalytics";
import { Search, TrendingUp, Users, DollarSign, Repeat } from "lucide-react";
import { format } from "date-fns";

interface CustomerAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CustomerAnalyticsModal = ({ open, onOpenChange }: CustomerAnalyticsModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<keyof CustomerAnalytics>("total_revenue");
  const [filterType, setFilterType] = useState<"all" | "repeat" | "single">("all");

  const { data: analytics, isLoading } = useCustomerAnalytics();
  const { data: stats } = useCustomerLifetimeStats();

  const filteredAnalytics = analytics?.filter(customer => {
    const matchesSearch = 
      customer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterType === "all" ||
      (filterType === "repeat" && customer.is_repeat_customer) ||
      (filterType === "single" && !customer.is_repeat_customer);
    
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    if (typeof a[sortBy] === 'number' && typeof b[sortBy] === 'number') {
      return (b[sortBy] as number) - (a[sortBy] as number);
    }
    return String(b[sortBy]).localeCompare(String(a[sortBy]));
  });

  const formatCurrency = (amount: number) => `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Customer Analytics</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">Loading analytics...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Customer Lifetime Value Analytics
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_customers}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Repeat Rate</CardTitle>
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.repeat_rate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats.repeat_customers} repeat customers
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Lifetime Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.average_lifetime_value)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Tours/Customer</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.average_tours_per_customer.toFixed(1)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={filterType} onValueChange={(value: "all" | "repeat" | "single") => setFilterType(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              <SelectItem value="repeat">Repeat Customers</SelectItem>
              <SelectItem value="single">Single Tour Only</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={(value: keyof CustomerAnalytics) => setSortBy(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_revenue">Revenue (High to Low)</SelectItem>
              <SelectItem value="total_tours">Tour Count</SelectItem>
              <SelectItem value="average_tour_value">Avg Tour Value</SelectItem>
              <SelectItem value="first_tour_date">First Tour Date</SelectItem>
              <SelectItem value="last_tour_date">Recent Tour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Customer Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Tours</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
                <TableHead className="text-right">Avg Value</TableHead>
                <TableHead>First Tour</TableHead>
                <TableHead>Recent Tour</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAnalytics?.map((customer) => (
                <TableRow key={customer.customer_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {customer.first_name} {customer.last_name}
                      </div>
                      {customer.is_repeat_customer && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Repeat Customer
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{customer.email}</div>
                      <div className="text-muted-foreground">{customer.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {customer.total_tours}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(customer.total_revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(customer.average_tour_value)}
                  </TableCell>
                  <TableCell>
                    {customer.first_tour_date ? format(new Date(customer.first_tour_date), 'MMM dd, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {customer.last_tour_date ? format(new Date(customer.last_tour_date), 'MMM dd, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {customer.status_breakdown.completed > 0 && (
                        <Badge variant="default" className="mr-1">
                          {customer.status_breakdown.completed} Completed
                        </Badge>
                      )}
                      {customer.status_breakdown.pending > 0 && (
                        <Badge variant="secondary" className="mr-1">
                          {customer.status_breakdown.pending} Pending
                        </Badge>
                      )}
                      {customer.status_breakdown.host > 0 && (
                        <Badge variant="outline" className="mr-1">
                          {customer.status_breakdown.host} Host
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredAnalytics?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No customers found matching your criteria.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};