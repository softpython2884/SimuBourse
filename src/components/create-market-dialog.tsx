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
  title: z.string().min(10, "Title must be at least 10 characters.").max(100, "Title must not exceed 100 characters."),
  category: z.string().min(3, "Category must be at least 3 characters."),
  outcomes: z.array(z.object({ name: z.string().min(1, "Outcome name cannot be empty.") })).min(2, "There must be at least 2 outcomes.").max(5, "There cannot be more than 5 outcomes."),
  closingDate: z.date({ required_error: "A closing date is required."}),
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
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to create a market.' });
      return;
    }

    setIsLoading(true);
    const result = await createUserMarket(values);
    setIsLoading(false);

    if (result.error) {
      toast({ variant: 'destructive', title: "Creation Failed", description: result.error });
    } else if (result.success) {
      toast({ title: "Success", description: result.success });
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
        <Button>Create Market</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Create a New Prediction Market</DialogTitle>
          <DialogDescription>
            Define an event and its possible outcomes. Other users will be able to bet on it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Market Title</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Who will win the next election?" {...field} />
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
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Politics, Sports, Technology" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />


                <div className="space-y-4">
                    <FormLabel>Possible Outcomes</FormLabel>
                    {fields.map((field, index) => (
                        <FormField
                            key={field.id}
                            control={form.control}
                            name={`outcomes.${index}.name`}
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            <Input placeholder={`Outcome ${index + 1}`} {...field} />
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
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Outcome
                        </Button>
                    )}
                </div>

                <FormField
                    control={form.control}
                    name="closingDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Bet Closing Date</FormLabel>
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
                                    <span>Choose a date</span>
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
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Market
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
