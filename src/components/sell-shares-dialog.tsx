'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { sellShares } from '@/lib/actions/companies';
import { useRouter } from 'next/navigation';
import { usePortfolio } from '@/context/portfolio-context';

interface SellSharesDialogProps {
  companyId: number;
  companyName: string;
  sharePrice: number;
  sharesHeld: number;
  children: React.ReactNode;
  isListed?: boolean;
}

const formSchema = z.object({
  quantity: z.coerce.number().positive({ message: 'Quantity must be greater than zero.' }),
});

export function SellSharesDialog({ companyId, companyName, sharePrice, sharesHeld, children, isListed = false }: SellSharesDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { refreshPortfolio } = usePortfolio();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        quantity: undefined,
    }
  });

  const quantity = form.watch('quantity') || 0;
  const proceeds = quantity * sharePrice;
  const title = isListed ? `Sell Shares of ${companyName}` : `Sell Stakes in ${companyName}`;
  const description = isListed
    ? `Selling price per share: $${sharePrice.toFixed(4)}. Shares held: ${sharesHeld.toLocaleString(undefined, {maximumFractionDigits: 4})}`
    : `Buyback price per share: $${sharePrice.toFixed(4)}. Shares held: ${sharesHeld.toLocaleString(undefined, {maximumFractionDigits: 4})}`;

  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.quantity > sharesHeld) {
        form.setError('quantity', { message: `You cannot sell more than your ${sharesHeld.toFixed(4)} shares.` });
        return;
    }
    const result = await sellShares(companyId, values.quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else if (result.success) {
      toast({ title: 'Success', description: result.success });
      await refreshPortfolio();
      router.refresh();
      setOpen(false);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Sell</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0.0000"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} />
                    </FormControl>
                     <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7" onClick={() => form.setValue('quantity', sharesHeld, { shouldValidate: true })}>
                        Max
                      </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="text-sm text-muted-foreground">
                {quantity > 0 ? `You will receive ≈ $${proceeds.toFixed(2)} from the company treasury.` : 'Enter a quantity to sell.'}
            </div>

            <DialogFooter>
               <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
               <Button type="submit" disabled={form.formState.isSubmitting || quantity > sharesHeld || !form.formState.isValid}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sell for ${proceeds > 0 ? proceeds.toFixed(2) : '0.00'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
