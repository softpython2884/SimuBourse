'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePortfolio, Asset } from '@/context/portfolio-context';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface TradeDialogProps {
  asset: Asset;
  tradeType: 'Buy' | 'Sell';
  children: React.ReactNode;
}

const formSchema = z.object({
  quantity: z.coerce.number().positive({ message: 'La quantité doit être positive.' }),
});

export function TradeDialog({ asset, tradeType, children }: TradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { buyAsset, sellAsset, cash, getHoldingQuantity } = usePortfolio();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: undefined,
    },
    mode: 'onChange',
  });

  const quantity = form.watch('quantity') || 0;
  const totalValue = quantity * asset.price;
  const tradeTypeFr = tradeType === 'Buy' ? 'Acheter' : 'Vendre';
  const holdingQuantity = getHoldingQuantity(asset.ticker);
  
  let isTradeDisabled = false;
  if (tradeType === 'Buy' && totalValue > cash) {
      isTradeDisabled = true;
  }
  if (tradeType === 'Sell' && quantity > holdingQuantity) {
      isTradeDisabled = true;
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (tradeType === 'Buy') {
      await buyAsset(asset, values.quantity);
    } else {
      await sellAsset(asset, values.quantity);
    }
    setIsLoading(false);
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        form.reset();
      }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {tradeTypeFr} {asset.name} ({asset.ticker})
          </DialogTitle>
          <DialogDescription>
            Prix actuel: ${asset.price.toFixed(2)}. 
            {tradeType === 'Buy' ? ` Fonds disponibles: $${cash.toFixed(2)}.` : ` Vous possédez: ${holdingQuantity.toLocaleString()}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantité</FormLabel>
                   <div className="relative">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                        onClick={() => {
                          if (asset.price > 0) {
                            let maxQuantity: number;
                            if(tradeType === 'Buy') {
                                maxQuantity = cash / asset.price;
                                if (asset.type === 'Stock') maxQuantity = Math.floor(maxQuantity);
                            } else {
                                maxQuantity = holdingQuantity;
                            }
                            form.setValue('quantity', maxQuantity > 0 ? maxQuantity : 0, { shouldValidate: true });
                          }
                        }}
                      >
                        Max
                      </Button>
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="text-sm font-medium">
              {tradeType === 'Buy' ? 'Coût total' : 'Produit total'}: ${totalValue.toFixed(2)}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading || isTradeDisabled || !form.formState.isValid}>
                 {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer {tradeTypeFr}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
