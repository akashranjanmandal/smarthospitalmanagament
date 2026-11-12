"use client";

import { useState, useEffect, useCallback } from "react";
import { getBedDashboardData, deleteAllBedData, getDepartmentsForWard } from "@/actions/beds";
import { BedStatsCards } from "./bed-stats-cards";
import { BedGrid } from "./bed-grid";
import { BedStatusDialog } from "./bed-status-dialog";
import { canCreate, canUpdate as canUpdateModule, canDelete } from "@/lib/permissions";
import { CreateBedDialog } from "./create-bed-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BED_TYPE_LABELS, BED_STATUS_LABELS, GENDER_WARD_LABELS } from "@/lib/constants";
import { RefreshCw, Filter, Clock, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function BedDashboard({ initialData, userRole }) {
  const [data, setData] = useState(initialData);
  const [selectedBed, setSelectedBed] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedBedType, setSelectedBedType] = useState("all");
  const [selectedGenderWard, setSelectedGenderWard] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    getDepartmentsForWard().then((res) => {
      if (res.success) setDepartmentsList(res.data);
    });
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await getBedDashboardData();
      if (result.success) {
        setData(result.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Failed to refresh bed data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleBedClick = (bed, ward) => {
    setSelectedBed({ ...bed, ward });
    setDialogOpen(true);
  };

  const handleStatusUpdated = () => {
    refreshData();
    setDialogOpen(false);
    setSelectedBed(null);
  };

  const handleClearAllBeds = async () => {
    if (!confirm("Are you sure you want to clear all bed and ward data?")) return;
    setIsRefreshing(true);
    try {
      const res = await deleteAllBedData();
      if (res.success) {
        toast.success(res.message);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to clear bed data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Only roles with beds "create" permission can add wards and beds.
  const canManageBeds = canCreate("beds", userRole);

  const pageTitle = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Bed Management
      </h1>
      <p className="text-sm text-muted-foreground">
        Real-time occupancy tracking and bed allocation across hospital wards.
      </p>
    </div>
  );

  if (!data || !data.floors || Object.keys(data.floors).length === 0) {
    return (
      <div className="space-y-6">
      {pageTitle}
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M2 4v16"/>
              <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
              <path d="M2 17h20"/>
              <path d="M6 8v9"/>
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-foreground">No Wards or Beds Registered</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            All bed management tables are ready for actual hospital data. Register your real hospital wards and beds to start tracking occupancy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={refreshData} className="gap-2 rounded-xl">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {canManageBeds && (
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 font-bold rounded-xl shadow-soft">
              <Plus className="h-4 w-4" /> Add Ward or Bed
            </Button>
          )}
        </div>

        <CreateBedDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          wards={data?.wards || []}
          departments={departmentsList}
          onCreated={refreshData}
        />
      </div>
      </div>
    );
  }

  // Extract unique values for filter dropdowns
  const allWards = data.wards || [];
  const floors = Object.keys(data.floors).sort((a, b) => a - b);
  const departments = [...new Map(allWards.map((w) => [w.department.id, w.department])).values()];

  // Apply filters
  const getFilteredWards = () => {
    let wards = allWards;
    if (selectedDepartment !== "all") {
      wards = wards.filter((w) => w.department.id === selectedDepartment);
    }
    if (selectedGenderWard !== "all") {
      wards = wards.filter((w) => w.genderWard === selectedGenderWard);
    }
    // Filter beds within wards
    wards = wards.map((ward) => {
      let beds = ward.beds;
      if (selectedBedType !== "all") {
        beds = beds.filter((b) => b.bedType === selectedBedType);
      }
      if (selectedStatus !== "all") {
        beds = beds.filter((b) => b.status === selectedStatus);
      }
      return { ...ward, beds };
    });
    // Remove wards with no beds after filtering
    wards = wards.filter((w) => w.beds.length > 0);
    return wards;
  };

  // Build filtered floors
  const getFilteredFloors = () => {
    const filteredWards = getFilteredWards();
    const result = {};
    for (const ward of filteredWards) {
      if (selectedFloor !== "all" && String(ward.floor) !== String(selectedFloor)) continue;
      if (!result[ward.floor]) {
        result[ward.floor] = [];
      }
      result[ward.floor].push(ward);
    }
    return result;
  };

  const filteredFloors = getFilteredFloors();
  const hasActiveFilters =
    selectedFloor !== "all" ||
    selectedDepartment !== "all" ||
    selectedBedType !== "all" ||
    selectedGenderWard !== "all" ||
    selectedStatus !== "all";

  const clearFilters = () => {
    setSelectedFloor("all");
    setSelectedDepartment("all");
    setSelectedBedType("all");
    setSelectedGenderWard("all");
    setSelectedStatus("all");
  };

  const canUpdate = canUpdateModule("beds", userRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {pageTitle}
        <div className="flex items-center gap-2">
          {canManageBeds && (
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="h-8 gap-1.5 font-bold shadow-soft"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Ward or Bed</span>
            </Button>
          )}
          {(userRole === "ADMIN" || userRole === "SUPER_ADMIN") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAllBeds}
              className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Bed Data</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <BedStatsCards stats={data.stats} />

      {/* Filter Bar + Last Updated */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </div>

          {/* Floor Filter */}
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-auto min-w-[130px] h-9 text-sm" id="filter-floor">
              <SelectValue placeholder="Floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f} value={String(f)}>
                  Floor {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department Filter */}
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-auto min-w-[170px] h-9 text-sm" id="filter-department">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bed Type Filter */}
          <Select value={selectedBedType} onValueChange={setSelectedBedType}>
            <SelectTrigger className="w-auto min-w-[150px] h-9 text-sm" id="filter-bed-type">
              <SelectValue placeholder="Bed Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(BED_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Gender Ward Filter */}
          <Select value={selectedGenderWard} onValueChange={setSelectedGenderWard}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm" id="filter-gender-ward">
              <SelectValue placeholder="Gender Ward" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {Object.entries(GENDER_WARD_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-auto min-w-[160px] h-9 text-sm" id="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(BED_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
              id="clear-filters"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Last Updated + Manual Refresh */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <Clock className="h-3 w-3" />
            <span suppressHydrationWarning>Updated {lastUpdated.toLocaleTimeString("en-US")}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
            className="h-8 gap-1.5"
            id="refresh-beds"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Bed Grid by Floor */}
      {Object.keys(filteredFloors).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-16 h-16 rounded-xl bg-muted/50 flex items-center justify-center">
            <Filter className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-sm">No beds match the selected filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : (
        Object.entries(filteredFloors)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([floor, wards]) => (
            <div key={floor} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Floor {floor}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {wards.reduce((sum, w) => sum + w.beds.length, 0)} beds
                </Badge>
              </div>
              <BedGrid
                wards={wards}
                onBedClick={canUpdate ? handleBedClick : undefined}
              />
            </div>
          ))
      )}

      {/* Status Update Dialog */}
      {selectedBed && (
        <BedStatusDialog
          bed={selectedBed}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onStatusUpdated={handleStatusUpdated}
          canAdmit={canCreate("admissions", userRole)}
          canDeleteBed={canDelete("beds", userRole)}
        />
      )}

      {/* Create Ward or Bed Dialog */}
      <CreateBedDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        wards={data?.wards || []}
        departments={departmentsList}
        onCreated={refreshData}
      />
    </div>
  );
}
