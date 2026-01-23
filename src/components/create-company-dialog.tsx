'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createCompany } from '@/lib/actions/companies';
import { Loader2 } from 'lucide-react';
import { usePortfolio } from '@/context/portfolio-context';
import { useRouter } from 'next/navigation';

const companyFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters.").max(50, "Name must not exceed 50 characters."),
  industry: z.string().min(3, "Industry must be at least 3 characters.").max(50, "Industry must not exceed 50 characters."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(200, "Description must not exceed 200 characters."),
});

export function CreateCompanyDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { cash, refreshPortfolio } = usePortfolio();
  const router = useRouter();
  const creationCost = 1000;

  const form = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      industry: '',
      description: '',
    },
  });

  async function onSubmit(values: z.infer<typeof companyFormSchema>) {
    const result = await createCompany(values);

    if (result.error) {
      toast({ variant: 'destructive', title: "Creation Failed", description: result.error });
    } else if (result.success) {
      toast({ title: "Success", description: result.success });
      await refreshPortfolio();
      setOpen(false);
      form.reset();
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button>Create New Company</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Launch a New Company</DialogTitle>
          <DialogDescription>
            Creating a company costs ${creationCost.toLocaleString()}. This amount will form its initial treasury.
            You will be appointed CEO.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Innovatech Solutions" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Industry Sector</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Technology, Energy, Healthcare" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Briefly describe your company's mission." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />


                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || cash < creationCost}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Company (${creationCost.toLocaleString()})
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
