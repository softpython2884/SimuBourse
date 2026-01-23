'use client';

import { useEffect, useMemo } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortfolio } from "@/context/portfolio-context";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "./ui/input";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMarketData } from "@/context/market-data-context";

const profileFormSchema = z.object({
  displayName: z.string().min(3, { message: "Username must be at least 3 characters." }),
  phoneNumber: z.string().optional(),
});


export default function ProfileClientPage() {
    const { userProfile, updateUserProfile, transactions, holdings, cash, initialCash, loading } = usePortfolio();
    const { getAssetByTicker } = useMarketData();

    const form = useForm<z.infer<typeof profileFormSchema>>({
      resolver: zodResolver(profileFormSchema),
      defaultValues: { 
        displayName: '',
        phoneNumber: '',
      },
    });

    useEffect(() => {
        if (userProfile) {
            form.reset({
                displayName: userProfile.displayName,
                phoneNumber: userProfile.phoneNumber || '',
            })
        }
    }, [userProfile, form]);

    const getInitials = (displayName: string | undefined) => {
        if (!displayName) return 'U';
        return displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    const assetsValue = useMemo(() => holdings.reduce((sum, holding) => {
        const asset = getAssetByTicker(holding.ticker);
        const currentPrice = asset?.price || holding.avgCost;
        return sum + (holding.quantity * currentPrice);
    }, 0), [holdings, getAssetByTicker]);

    const portfolioValue = assetsValue + cash;
    const totalGains = portfolioValue - initialCash;
    const totalGainsPercentage = initialCash > 0 ? (totalGains / initialCash) * 100 : 0;


    async function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
      await updateUserProfile(values);
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (!userProfile) {
        return (
            <div className="text-center">
                <p>Unable to load profile data.</p>
            </div>
        )
    }

  return (
    <Tabs defaultValue="overview">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings">Settings & Security</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                      Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarFallback>{getInitials(userProfile?.displayName)}</AvatarFallback>
                  </Avatar>
                  <h2 className="text-2xl font-bold">{userProfile?.displayName}</h2>
                  <p className="text-muted-foreground">{userProfile?.email}</p>
                  <p className="text-muted-foreground">{userProfile?.phoneNumber}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Portfolio Value</span>
                    <span className="font-bold">${portfolioValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Gains</span>
                    <span className={`font-bold ${totalGains >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {totalGains >= 0 ? '+' : '-'}${Math.abs(totalGains).toFixed(2)} ({totalGainsPercentage.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Win Rate (Betting)</span>
                    <span className="font-bold">N/A</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>A record of all your recent trading activity.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Asset/Details</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.length > 0 ? (
                            transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell className={tx.type === 'Buy' ? 'text-red-500' : 'text-green-500'}>{tx.type === 'Buy' ? 'Buy' : 'Sell'}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{tx.name}</div>
                                        <div className="text-sm text-muted-foreground">{tx.ticker}</div>
                                    </TableCell>
                                    <TableCell>{tx.quantity.toLocaleString(undefined, {maximumFractionDigits: 8})}</TableCell>
                                    <TableCell>${tx.price.toFixed(2)}</TableCell>
                                    <TableCell className={tx.type === 'Buy' ? 'text-red-500' : 'text-green-500'}>
                                        {tx.type === 'Buy' ? '-' : '+'}${tx.value.toFixed(2)}
                                    </TableCell>
                                    <TableCell>{format(new Date(tx.createdAt), 'd MMM yyyy, HH:mm', { locale: fr })}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                No transactions yet.
                            </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
      </TabsContent>

      <TabsContent value="settings">
          <Card>
              <CardHeader>
                  <CardTitle>Edit Profile</CardTitle>
              </CardHeader>
              <CardContent>
                  <Form {...form}>
                      <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-4 max-w-lg">
                          <FormField
                              control={form.control}
                              name="displayName"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Username</FormLabel>
                                      <FormControl>
                                          <Input placeholder="Your name" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={form.control}
                              name="phoneNumber"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Phone number</FormLabel>
                                      <FormControl>
                                          <Input placeholder="+1 555 123 4567" {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <Button type="submit" disabled={form.formState.isSubmitting}>
                              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Save changes
                          </Button>
                      </form>
                  </Form>
              </CardContent>
          </Card>
      </TabsContent>
    </Tabs>
  );
}
