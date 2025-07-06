'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign } from 'lucide-react';
import { addCashToPortfolio } from '@/lib/actions/portfolio';

const formSchema = z.object({
  amount: z.coerce.number().positive({ message: 'Le montant doit être un nombre positif.' }).max(1000000, "Vous ne pouvez pas ajouter plus de 1,000,000 $ à la fois."),
});

export function AddCashDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 10000,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await addCashToPortfolio(values.amount);
    if (result.error) {
        toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else {
        toast({ title: 'Succès', description: result.success });
        setOpen(false);
        form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <DollarSign className="mr-2" />
            Ajouter des fonds
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajouter des fonds au portefeuille</DialogTitle>
          <DialogDescription>
            Simulez un virement bancaire pour augmenter vos fonds disponibles. Cela augmentera aussi votre capital de départ pour un suivi correct des gains/pertes.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Montant à ajouter</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="10000" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmer l'ajout
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
