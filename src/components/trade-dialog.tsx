'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePortfolio } from '@/context/portfolio-context';
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
import { AssetFromDb } from '@/lib/actions/assets';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface TradeDialogProps {
  asset: AssetFromDb;
  tradeType: 'Buy' | 'Sell';
  children: React.ReactNode;
}

const formSchema = z.object({
  quantity: z.coerce.number().positive({ message: 'Quantity must be positive.' }),
  stopLoss: z.coerce.number().optional(),
  takeProfit: z.coerce.number().optional(),
});

export function TradeDialog({ asset, tradeType, children }: TradeDialogProps) {
  const [open, setOpen] = useState(false);
  const { buyAsset, sellAsset, cash, getHoldingQuantity } = usePortfolio();

  const formSchemaWithPriceValidation = formSchema.refine(
    (data) => !data.stopLoss || data.stopLoss < asset.price,
    {
      message: `Stop-Loss must be lower than current price ($${asset.price.toFixed(2)}).`,
      path: ['stopLoss'],
    }
  ).refine(
    (data) => !data.takeProfit || data.takeProfit > asset.price,
    {
       message: `Take-Profit must be higher than current price ($${asset.price.toFixed(2)}).`,
       path: ['takeProfit'],
    }
  );

  const form = useForm<z.infer<typeof formSchemaWithPriceValidation>>({
    resolver: zodResolver(formSchemaWithPriceValidation),
    defaultValues: {
      quantity: undefined,
      stopLoss: undefined,
      takeProfit: undefined,
    },
    mode: 'onChange',
  });

  const quantity = form.watch('quantity') || 0;
  const totalValue = quantity * asset.price;
  const tradeTypeFr = tradeType === 'Buy' ? 'Buy' : 'Sell';
  const holdingQuantity = getHoldingQuantity(asset.ticker);
  
  let isTradeDisabled = false;
  if (tradeType === 'Buy' && totalValue > cash) {
      isTradeDisabled = true;
  }
  if (tradeType === 'Sell' && quantity > holdingQuantity) {
      isTradeDisabled = true;
  }

  async function onSubmit(values: z.infer<typeof formSchemaWithPriceValidation>) {
    if (tradeType === 'Buy') {
      await buyAsset(asset.ticker, values.quantity, values.stopLoss, values.takeProfit);
    } else {
      await sellAsset(asset.ticker, values.quantity);
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
            Current price: ${asset.price.toFixed(asset.price > 10 ? 2 : 4)}.
            {tradeType === 'Buy' ? ` Available funds: $${cash.toFixed(2)}.` : ` You own: ${holdingQuantity.toLocaleString()}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
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
            
             {tradeType === 'Buy' && (
                <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Automatic Orders (Advanced)</AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-4 pt-2">
                            <p className="text-sm text-muted-foreground">
                                Set orders to automatically sell your assets if the price reaches defined thresholds.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="stopLoss"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Stop-Loss</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="number" 
                                                    step="any" 
                                                    placeholder={`< ${asset.price.toFixed(2)}`} 
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="takeProfit"
                                    render={({ field }) => (
                                         <FormItem>
                                            <FormLabel>Take-Profit</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="number" 
                                                    step="any" 
                                                    placeholder={`> ${asset.price.toFixed(2)}`} 
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                </Accordion>
             )}

            <div className="text-sm font-medium pt-2">
              {tradeType === 'Buy' ? 'Total Cost' : 'Total Proceeds'}: ${totalValue.toFixed(2)}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || isTradeDisabled || !form.formState.isValid}>
                 {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm {tradeTypeFr}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
