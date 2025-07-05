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
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

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
  const { buyAsset, sellAsset, cash, getHoldingQuantity } = usePortfolio();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 0,
    },
  });

  const quantity = form.watch('quantity');
  const totalValue = quantity * asset.price;
  const tradeTypeFr = tradeType === 'Buy' ? 'Acheter' : 'Vendre';
  const holdingQuantity = getHoldingQuantity(asset.ticker);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (tradeType === 'Buy') {
      buyAsset(asset, values.quantity);
    } else {
      sellAsset(asset, values.quantity);
    }
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
            {tradeType === 'Buy' ? ` Fonds disponibles: $${cash.toFixed(2)}.` : ` Vous possédez: ${holdingQuantity}.`}
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
                        <Input type="number" step="any" placeholder="0" {...field} className={tradeType === 'Buy' ? 'pr-12' : ''} />
                      </FormControl>
                      {tradeType === 'Buy' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                          onClick={() => {
                            if (asset.price > 0) {
                              const maxQuantity = Math.floor(cash / asset.price);
                              form.setValue('quantity', maxQuantity > 0 ? maxQuantity : 0, { shouldValidate: true });
                            }
                          }}
                        >
                          Max
                        </Button>
                      )}
                    </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="text-sm font-medium">
              {tradeType === 'Buy' ? 'Coût total' : 'Produit total'}: ${totalValue.toFixed(2)}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit">
                Confirmer {tradeTypeFr}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
