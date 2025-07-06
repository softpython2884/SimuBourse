'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePortfolio } from '@/context/portfolio-context';
import { placeBet } from '@/lib/actions/markets';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { MarketWithOutcomes } from '@/lib/actions/markets';

interface PlaceBetDialogProps {
  market: MarketWithOutcomes;
  children: React.ReactNode;
}

const formSchema = z.object({
  outcomeId: z.coerce.number({invalid_type_error: "Veuillez choisir une issue."}).positive(),
  amount: z.coerce.number().positive({ message: 'Le montant doit être positif.' }),
});

export function PlaceBetDialog({ market, children }: PlaceBetDialogProps) {
  const [open, setOpen] = useState(false);
  const { cash } = usePortfolio();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        amount: undefined,
        outcomeId: undefined,
    }
  });

  const amount = form.watch('amount') || 0;
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await placeBet(values.outcomeId, market.id, values.amount);
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
        setOpen(isOpen)
        if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{market.title}</DialogTitle>
          <DialogDescription>
            Placez votre pari sur une des issues. Fonds disponibles: ${cash.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="outcomeId"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Choisissez une issue</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      className="flex flex-col space-y-1"
                    >
                      {market.outcomes.map(outcome => (
                         <FormItem key={outcome.id} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={String(outcome.id)} />
                            </FormControl>
                            <FormLabel className="font-normal">{outcome.name}</FormLabel>
                          </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant à parier</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                     <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7" onClick={() => form.setValue('amount', cash, { shouldValidate: true })}>
                        Max
                      </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
               <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
               <Button type="submit" disabled={form.formState.isSubmitting || amount > cash || !form.formState.isValid}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Parier ${amount.toFixed(2)}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
