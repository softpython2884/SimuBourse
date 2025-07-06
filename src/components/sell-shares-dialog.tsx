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

interface SellSharesDialogProps {
  companyId: number;
  companyName: string;
  sharePrice: number;
  sharesHeld: number;
  children: React.ReactNode;
}

const formSchema = z.object({
  quantity: z.coerce.number().positive({ message: 'La quantité doit être supérieure à zéro.' }),
});

export function SellSharesDialog({ companyId, companyName, sharePrice, sharesHeld, children }: SellSharesDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        quantity: undefined,
    }
  });

  const quantity = form.watch('quantity') || 0;
  const proceeds = quantity * sharePrice;
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.quantity > sharesHeld) {
        form.setError('quantity', { message: `Vous ne pouvez pas vendre plus que vos ${sharesHeld.toFixed(4)} parts.` });
        return;
    }
    const result = await sellShares(companyId, values.quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else if (result.success) {
      toast({ title: 'Succès', description: result.success });
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
          <DialogTitle>Vendre des Parts de {companyName}</DialogTitle>
          <DialogDescription>
            Prix de rachat par part : ${sharePrice.toFixed(2)}. Parts détenues : {sharesHeld.toLocaleString(undefined, {maximumFractionDigits: 4})}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité à vendre</FormLabel>
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
                {quantity > 0 ? `Vous recevrez ≈ ${proceeds.toFixed(2)}$ de la trésorerie de l'entreprise.` : 'Entrez une quantité à vendre.'}
            </div>

            <DialogFooter>
               <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
               <Button type="submit" disabled={form.formState.isSubmitting || quantity > sharesHeld || !form.formState.isValid}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vendre pour ${proceeds > 0 ? proceeds.toFixed(2) : '0.00'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
