"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { departmentSchema } from "@/lib/validations";
import { getDepartmentById, updateDepartment } from "@/actions/departments";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Building2, Save } from "lucide-react";

export default function EditDepartmentPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    async function fetchDepartment() {
      const result = await getDepartmentById(params.id);
      if (result.success) {
        reset({
          name: result.data.name,
          description: result.data.description || "",
          status: result.data.status,
        });
      } else {
        toast.error(result.message);
        router.push("/departments");
      }
      setFetching(false);
    }
    fetchDepartment();
  }, [params.id, reset, router]);

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await updateDepartment(params.id, data);
    if (result.success) {
      toast.success(result.message);
      router.push("/departments");
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 animate-in fade-in">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading department...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <PageHeader
        title="Edit Department"
        description="Update department information and settings"
        breadcrumbs={[
          { label: "Departments", href: "/departments" },
          { label: "Edit Department" },
        ]}
      />

      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden mt-6">
        <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Building2 className="size-5" />
            </div>
            Department Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2.5">
              <Label htmlFor="name" className="font-semibold text-foreground/80">
                Department Name <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="name" 
                {...register("name")} 
                className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30 text-base"
              />
              {errors.name && (
                <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="description" className="font-semibold text-foreground/80">Description</Label>
              <Textarea
                id="description"
                rows={4}
                {...register("description")}
                className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base"
                placeholder="Brief description of the department's specialties..."
              />
              {errors.description && (
                <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label className="font-semibold text-foreground/80">Status</Label>
              <Select
                onValueChange={(val) => setValue("status", val)}
                defaultValue="ACTIVE"
              >
                <SelectTrigger className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg">
                  <SelectItem value="ACTIVE" className="font-medium">Active</SelectItem>
                  <SelectItem value="INACTIVE" className="font-medium">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8">
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
                Update Department
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/departments")}
                className="w-full sm:w-auto h-12 rounded-xl font-bold"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}