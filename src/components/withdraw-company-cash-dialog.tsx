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
import { withdrawFromCompanyTreasury } from '@/lib/actions/companies';
import { useRouter } from 'next/navigation';
import { usePortfolio } from '@/context/portfolio-context';

interface WithdrawCompanyCashDialogProps {
  companyId: number;
  companyCash: number;
  children: React.ReactNode;
}

const formSchema = z.object({
  amount: z.coerce.number().positive({ message: 'Le montant doit être supérieur à zéro.' }),
});

export function WithdrawCompanyCashDialog({ companyId, companyCash, children }: WithdrawCompanyCashDialogProps) {
  const [open, setOpen] = useState(false);
  const { refreshPortfolio } = usePortfolio();
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        amount: undefined,
    }
  });

  const amount = form.watch('amount') || 0;
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await withdrawFromCompanyTreasury(companyId, values.amount);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else if (result.success) {
      toast({ title: 'Succès', description: result.success });
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
          <DialogTitle>Retirer des fonds de la Trésorerie</DialogTitle>
          <DialogDescription>
            Transférez des fonds de la trésorerie de l'entreprise vers votre solde personnel.
            Trésorerie disponible : ${companyCash.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant à retirer</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} />
                    </FormControl>
                     <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7" onClick={() => form.setValue('amount', companyCash, { shouldValidate: true })}>
                        Max
                      </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
               <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
               <Button type="submit" disabled={form.formState.isSubmitting || amount > companyCash || !form.formState.isValid}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Retirer ${amount > 0 ? amount.toFixed(2) : '0.00'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
