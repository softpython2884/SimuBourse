'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createUserMarket } from '@/lib/actions/markets';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, PlusCircle, XCircle } from 'lucide-react';

const marketFormSchema = z.object({
  title: z.string().min(10, "Le titre doit faire au moins 10 caractères.").max(100, "Le titre ne doit pas dépasser 100 caractères."),
  category: z.string().min(3, "La catégorie doit faire au moins 3 caractères."),
  outcomes: z.array(z.object({ name: z.string().min(1, "Le nom de l'issue ne peut pas être vide.") })).min(2, "Il doit y avoir au moins 2 issues.").max(5, "Il ne peut y avoir plus de 5 issues."),
  closingDate: z.date({ required_error: "Une date de clôture est requise."}),
});

export function CreateMarketDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof marketFormSchema>>({
    resolver: zodResolver(marketFormSchema),
    defaultValues: {
      title: '',
      category: '',
      outcomes: [{ name: '' }, { name: '' }],
      closingDate: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "outcomes"
  });

  async function onSubmit(values: z.infer<typeof marketFormSchema>) {
    if (!user) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Vous devez être connecté pour créer un marché.' });
      return;
    }
    
    setIsLoading(true);
    const result = await createUserMarket(values);
    setIsLoading(false);

    if (result.error) {
      toast({ variant: 'destructive', title: "Échec de la création", description: result.error });
    } else if (result.success) {
      toast({ title: "Succès", description: result.success });
      setOpen(false);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button>Créer un Marché</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Créer un Nouveau Marché de Prédiction</DialogTitle>
          <DialogDescription>
            Définissez un événement et ses issues possibles. Les autres utilisateurs pourront parier dessus.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Titre du marché</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Qui gagnera la prochaine élection ?" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Catégorie</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Politique, Sport, Technologie" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className="space-y-4">
                    <FormLabel>Issues Possibles</FormLabel>
                    {fields.map((field, index) => (
                        <FormField
                            key={field.id}
                            control={form.control}
                            name={`outcomes.${index}.name`}
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            <Input placeholder={`Issue ${index + 1}`} {...field} />
                                        </FormControl>
                                        {fields.length > 2 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <XCircle className="h-4 w-4 text-red-500"/>
                                            </Button>
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ))}
                    {fields.length < 5 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '' })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une issue
                        </Button>
                    )}
                </div>

                <FormField
                    control={form.control}
                    name="closingDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Date de clôture des paris</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP")
                                ) : (
                                    <span>Choisissez une date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                date < new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Créer le marché
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
