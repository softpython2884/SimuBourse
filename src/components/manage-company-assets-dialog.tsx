'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMarketData } from '@/context/market-data-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { buyAssetForCompany } from '@/lib/actions/companies';
import type { CompanyWithDetails } from '@/lib/actions/companies';

interface ManageCompanyAssetsDialogProps {
  company: CompanyWithDetails;
  children: React.ReactNode;
}

const formSchema = z.object({
  ticker: z.string().min(1, { message: "Veuillez sélectionner un actif." }),
  quantity: z.coerce.number().positive({ message: 'La quantité doit être positive.' }),
});

export function ManageCompanyAssetsDialog({ company, children }: ManageCompanyAssetsDialogProps) {
  const [open, setOpen] = useState(false);
  const { assets, getAssetByTicker } = useMarketData();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: undefined,
      quantity: undefined,
    },
    mode: 'onChange',
  });

  const selectedTicker = form.watch('ticker');
  const quantity = form.watch('quantity') || 0;
  
  const selectedAsset = selectedTicker ? getAssetByTicker(selectedTicker) : null;
  const totalCost = selectedAsset ? quantity * selectedAsset.price : 0;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedAsset) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Actif non valide.' });
        return;
    }
    const result = await buyAssetForCompany(company.id, selectedAsset, values.quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else if (result.success) {
      toast({ title: 'Succès', description: result.success });
      setOpen(false);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acheter des Actifs pour {company.name}</DialogTitle>
          <DialogDescription>
            Trésorerie disponible : ${company.cash.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Actif</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un actif à acheter" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assets.map(asset => (
                        <SelectItem key={asset.ticker} value={asset.ticker}>
                          {asset.name} ({asset.ticker}) - ${asset.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="any" 
                      placeholder="0" 
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {selectedAsset && (
                <div className="text-sm text-muted-foreground">
                    Coût total de la transaction : ${totalCost.toFixed(2)}
                </div>
            )}

            <DialogFooter>
               <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
               <Button type="submit" disabled={form.formState.isSubmitting || totalCost > company.cash || !form.formState.isValid}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer l'Achat
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
