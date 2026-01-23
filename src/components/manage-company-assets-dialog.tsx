'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketData } from '@/context/market-data-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { buyAssetForCompany, sellAssetForCompany, buyMiningRigForCompany } from '@/lib/actions/companies';
import type { CompanyWithDetails } from '@/lib/actions/companies';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MINING_RIGS } from '@/lib/mining';

interface ManageCompanyAssetsDialogProps {
  company: CompanyWithDetails;
  children: React.ReactNode;
}

const buyFormSchema = z.object({
  ticker: z.string().min(1, { message: "Please select an asset." }),
  quantity: z.coerce.number().positive({ message: 'Quantity must be positive.' }),
});

const sellFormSchema = z.object({
  holdingId: z.coerce.number().positive({ message: "Please select an asset to sell." }),
  quantity: z.coerce.number().positive({ message: 'Quantity must be positive.' }),
});

const formatHashRate = (mhs: number) => {
    if (mhs >= 1_000_000) return `${(mhs / 1_000_000).toFixed(2)} TH/s`;
    if (mhs >= 1_000) return `${(mhs / 1_000).toFixed(2)} GH/s`;
    return `${mhs.toFixed(0)} MH/s`;
};

export function ManageCompanyAssetsDialog({ company, children }: ManageCompanyAssetsDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("buy");
  const { assets, getAssetByTicker } = useMarketData();
  const { toast } = useToast();
  const router = useRouter();
  
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

  const [isBuyingMiner, setIsBuyingMiner] = useState<string | null>(null);

  const selectedBuyTicker = buyForm.watch('ticker');
  const buyQuantity = buyForm.watch('quantity') || 0;
  const selectedBuyAsset = selectedBuyTicker ? getAssetByTicker(selectedBuyTicker) : null;
  const totalCost = selectedBuyAsset ? buyQuantity * selectedBuyAsset.price : 0;

  const selectedHoldingId = sellForm.watch('holdingId');
  const sellQuantity = sellForm.watch('quantity') || 0;
  const selectedHolding = selectedHoldingId ? company.holdings.find(h => h.id === selectedHoldingId) : null;
  const selectedSellAsset = selectedHolding ? getAssetByTicker(selectedHolding.ticker) : null;
  const totalProceeds = selectedSellAsset ? sellQuantity * selectedSellAsset.price : 0;
  const sellProfitLoss = selectedHolding && selectedSellAsset ? (selectedSellAsset.price - selectedHolding.avgCost) * sellQuantity : 0;

  async function onBuySubmit(values: z.infer<typeof buyFormSchema>) {
    if (!selectedBuyAsset) {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid asset.' });
        return;
    }
    const result = await buyAssetForCompany(company.id, values.ticker, values.quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else if (result.success) {
      toast({ title: 'Success', description: result.success });
      router.refresh();
      setOpen(false);
    }
  }

  async function onSellSubmit(values: z.infer<typeof sellFormSchema>) {
    if (!selectedSellAsset || !selectedHolding) {
      toast({ variant: 'destructive', title: 'Error', description: 'Invalid asset to sell.' });
      return;
    }
    if (values.quantity > selectedHolding.quantity) {
        sellForm.setError('quantity', { message: "Insufficient quantity."});
        return;
    }
    const result = await sellAssetForCompany(company.id, values.holdingId, values.quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else if (result.success) {
      toast({ title: 'Success', description: result.success });
      router.refresh();
      setOpen(false);
    }
  }
  
  async function onBuyMiner(rigId: string) {
    setIsBuyingMiner(rigId);
    const result = await buyMiningRigForCompany(company.id, rigId);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else if (result.success) {
      toast({ title: 'Success', description: result.success });
      router.refresh();
      setOpen(false);
    }
    setIsBuyingMiner(null);
  }

  const resetForms = () => {
    buyForm.reset();
    sellForm.reset();
    setIsBuyingMiner(null);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForms();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Portfolio of {company.name}</DialogTitle>
          <DialogDescription>
            Available Treasury: ${company.cash.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="buy">Buy Assets</TabsTrigger>
                <TabsTrigger value="sell">Sell Assets</TabsTrigger>
                <TabsTrigger value="miners">Buy Hardware</TabsTrigger>
            </TabsList>
            <TabsContent value="buy">
                <Form {...buyForm}>
                    <form onSubmit={buyForm.handleSubmit(onBuySubmit)} className="space-y-6 pt-4">
                        <FormField
                        control={buyForm.control}
                        name="ticker"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Asset</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an asset to buy" />
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
                            <FormLabel>Quantity</FormLabel>
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
                                Total transaction cost: ${totalCost.toFixed(2)}
                            </div>
                        )}
                        <DialogFooter>
                            <Button type="submit" className="w-full" disabled={buyForm.formState.isSubmitting || totalCost > company.cash || !buyForm.formState.isValid}>
                                {buyForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Purchase
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
                                    <FormLabel>Asset to Sell</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an asset to sell" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {company.holdings.length > 0 ? company.holdings.map(holding => (
                                                <SelectItem key={holding.id} value={String(holding.id)}>
                                                    {holding.name} ({holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })})
                                                </SelectItem>
                                            )) : <SelectItem value="none" disabled>No assets to sell</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {selectedHolding && (
                            <FormDescription>
                                You own: {selectedHolding.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} units.
                            </FormDescription>
                        )}
                        <FormField
                            control={sellForm.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quantity</FormLabel>
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
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <div>Sale proceeds: ${totalProceeds.toFixed(2)}</div>
                                {sellQuantity > 0 && selectedHolding && (
                                    <div className={cn(
                                        'font-medium',
                                        sellProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'
                                    )}>
                                        Potential Gain/Loss: {sellProfitLoss >= 0 ? '+' : '-'}${Math.abs(sellProfitLoss).toFixed(2)}
                                    </div>
                                )}
                            </div>
                        )}
                        <DialogFooter>
                            <Button type="submit" className="w-full" disabled={!company.holdings.length || sellForm.formState.isSubmitting || !sellForm.formState.isValid || (selectedHolding && sellQuantity > selectedHolding.quantity)}>
                                {sellForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Sale
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </TabsContent>
            <TabsContent value="miners">
                <div className="space-y-4 pt-4">
                    {MINING_RIGS.map((rig) => (
                        <div key={rig.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="font-semibold">{rig.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    Cost: ${rig.price.toLocaleString()} • Power: {formatHashRate(rig.hashRateMhs)}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => onBuyMiner(rig.id)}
                                disabled={isBuyingMiner !== null || company.cash < rig.price}
                            >
                                {isBuyingMiner === rig.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Buy
                            </Button>
                        </div>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
