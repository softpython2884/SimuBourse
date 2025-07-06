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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketData } from '@/context/market-data-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { buyAssetForCompany, sellAssetForCompany } from '@/lib/actions/companies';
import type { CompanyWithDetails } from '@/lib/actions/companies';

interface ManageCompanyAssetsDialogProps {
  company: CompanyWithDetails;
  children: React.ReactNode;
}

const buyFormSchema = z.object({
  ticker: z.string().min(1, { message: "Veuillez sélectionner un actif." }),
  quantity: z.coerce.number().positive({ message: 'La quantité doit être positive.' }),
});

const sellFormSchema = z.object({
  holdingId: z.coerce.number().positive({ message: "Veuillez sélectionner un actif à vendre." }),
  quantity: z.coerce.number().positive({ message: 'La quantité doit être positive.' }),
});

export function ManageCompanyAssetsDialog({ company, children }: ManageCompanyAssetsDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("buy");
  const { assets, getAssetByTicker, refreshData } = useMarketData();
  const { toast } = useToast();
  
  const buyForm = useForm<z.infer<typeof buyFormSchema>>({
    resolver: zodResolver(buyFormSchema),
    defaultValues: { ticker: undefined, quantity: undefined },
    mode: 'onChange',
  });

  const sellForm = useForm<z.infer<typeof sellFormSchema>>({
    resolver: zodResolver(sellFormSchema),
    defaultValues: { holdingId: undefined, quantity: undefined },
    mode: 'onChange',
  });

  const selectedBuyTicker = buyForm.watch('ticker');
  const buyQuantity = buyForm.watch('quantity') || 0;
  const selectedBuyAsset = selectedBuyTicker ? getAssetByTicker(selectedBuyTicker) : null;
  const totalCost = selectedBuyAsset ? buyQuantity * selectedBuyAsset.price : 0;

  const selectedHoldingId = sellForm.watch('holdingId');
  const sellQuantity = sellForm.watch('quantity') || 0;
  const selectedHolding = selectedHoldingId ? company.holdings.find(h => h.id === selectedHoldingId) : null;
  const selectedSellAsset = selectedHolding ? getAssetByTicker(selectedHolding.ticker) : null;
  const totalProceeds = selectedSellAsset ? sellQuantity * selectedSellAsset.price : 0;

  async function onBuySubmit(values: z.infer<typeof buyFormSchema>) {
    if (!selectedBuyAsset) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Actif non valide.' });
        return;
    }
    const result = await buyAssetForCompany(company.id, values.ticker, values.quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else if (result.success) {
      toast({ title: 'Succès', description: result.success });
      await refreshData();
      setOpen(false);
    }
  }

  async function onSellSubmit(values: z.infer<typeof sellFormSchema>) {
    if (!selectedSellAsset || !selectedHolding) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Actif à vendre non valide.' });
      return;
    }
    if (values.quantity > selectedHolding.quantity) {
        sellForm.setError('quantity', { message: "Quantité insuffisante."});
        return;
    }
    const result = await sellAssetForCompany(company.id, values.holdingId, values.quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else if (result.success) {
      toast({ title: 'Succès', description: result.success });
      await refreshData();
      setOpen(false);
    }
  }
  
  const resetForms = () => {
    buyForm.reset();
    sellForm.reset();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForms();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer le Portefeuille de {company.name}</DialogTitle>
          <DialogDescription>
            Trésorerie disponible : ${company.cash.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="buy">Acheter</TabsTrigger>
                <TabsTrigger value="sell">Vendre</TabsTrigger>
            </TabsList>
            <TabsContent value="buy">
                <Form {...buyForm}>
                    <form onSubmit={buyForm.handleSubmit(onBuySubmit)} className="space-y-6 pt-4">
                        <FormField
                        control={buyForm.control}
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
                        control={buyForm.control}
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
                        {selectedBuyAsset && (
                            <div className="text-sm text-muted-foreground">
                                Coût total de la transaction : ${totalCost.toFixed(2)}
                            </div>
                        )}
                        <DialogFooter>
                            <Button type="submit" className="w-full" disabled={buyForm.formState.isSubmitting || totalCost > company.cash || !buyForm.formState.isValid}>
                                {buyForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmer l'Achat
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </TabsContent>
            <TabsContent value="sell">
                <Form {...sellForm}>
                    <form onSubmit={sellForm.handleSubmit(onSellSubmit)} className="space-y-6 pt-4">
                        <FormField
                            control={sellForm.control}
                            name="holdingId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Actif à Vendre</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sélectionnez un actif à vendre" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {company.holdings.length > 0 ? company.holdings.map(holding => (
                                                <SelectItem key={holding.id} value={String(holding.id)}>
                                                    {holding.name} ({holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })})
                                                </SelectItem>
                                            )) : <SelectItem value="none" disabled>Aucun actif à vendre</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={sellForm.control}
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
                         {selectedSellAsset && (
                            <div className="text-sm text-muted-foreground">
                                Produit total de la vente : ${totalProceeds.toFixed(2)}
                            </div>
                        )}
                        <DialogFooter>
                            <Button type="submit" className="w-full" disabled={!company.holdings.length || sellForm.formState.isSubmitting || !sellForm.formState.isValid || (selectedHolding && sellQuantity > selectedHolding.quantity)}>
                                {sellForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmer la Vente
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
