"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DataTable({ columns, data, pagination, onPageChange }) {
  const [sorting, setSorting] = useState([]);

  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualPagination: !!pagination,
    pageCount: pagination?.totalPages || -1,
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/*
        Large-data-friendly table shell:
        - horizontal scroll on small screens (table-scroll-area) so wide
          tables never break mobile layout or force page-level scroll
        - sticky header stays visible while scrolling through many rows
        - server-side pagination (manualPagination) keeps the DOM small
          even when the underlying dataset is large
      */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-2xs">
        <div className="table-scroll-area overflow-x-auto max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/40">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground/80 h-11 whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30 transition-colors duration-150 border-border/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3.5 px-4 font-medium text-sm sm:text-base whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground font-medium text-sm sm:text-base">
                    No records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 border border-border/40 shadow-2xs">
          <p className="text-sm font-semibold text-muted-foreground text-center sm:text-left">
            Showing <span className="font-bold text-foreground">{(pagination.page - 1) * pagination.limit + 1}</span> to{" "}
            <span className="font-bold text-foreground">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{" "}
            <span className="font-bold text-foreground">{pagination.total}</span> entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold h-9 hover-zoom"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="size-4 mr-1" />
              Prev
            </Button>
            <span className="text-sm font-bold px-3 py-1 rounded-lg bg-background border border-border/50 text-foreground">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold h-9 hover-zoom"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}