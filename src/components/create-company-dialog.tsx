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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createCompany } from '@/lib/actions/companies';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const companyFormSchema = z.object({
  name: z.string().min(3, "Le nom doit faire au moins 3 caractères.").max(50, "Le nom ne doit pas dépasser 50 caractères."),
  industry: z.string().min(3, "L'industrie doit faire au moins 3 caractères.").max(50, "L'industrie ne doit pas dépasser 50 caractères."),
  description: z.string().min(10, "La description doit faire au moins 10 caractères.").max(200, "La description ne doit pas dépasser 200 caractères."),
});

export function CreateCompanyDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      industry: '',
      description: '',
    },
  });

  async function onSubmit(values: z.infer<typeof companyFormSchema>) {
    const result = await createCompany(values);

    if (result.error) {
      toast({ variant: 'destructive', title: "Échec de la création", description: result.error });
    } else if (result.success) {
      toast({ title: "Succès", description: result.success });
      setOpen(false);
      form.reset();
      router.refresh(); // Rafraîchit les données du serveur sur la page actuelle
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button>Créer une nouvelle entreprise</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Lancer une Nouvelle Entreprise</DialogTitle>
          <DialogDescription>
            Créez votre propre entreprise virtuelle. Gérez des actifs et distribuez des dividendes à vos actionnaires.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nom de l'entreprise</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Innovatech Solutions" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Secteur d'Activité</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Technologie, Énergie, Santé" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Décrivez brièvement la mission de votre entreprise." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Créer l'entreprise
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
