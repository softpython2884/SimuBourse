'use server';

import { getPublicUserProfile } from '@/lib/actions/public';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import Link from 'next/link';

function getInitials(name: string) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default async function PublicProfilePage({ userId }: { userId: string }) {
  const profile = await getPublicUserProfile(userId);

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
                <Link href="/companies">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Profil Public de {profile.displayName}</h1>
                <p className="text-muted-foreground">Membre depuis le {format(new Date(profile.createdAt), 'd MMMM yyyy', { locale: fr })}</p>
            </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
                <Card>
                    <CardContent className="flex flex-col items-center text-center pt-6">
                        <Avatar className="h-24 w-24 mb-4">
                            <AvatarFallback>{getInitials(profile.displayName)}</AvatarFallback>
                        </Avatar>
                        <h2 className="text-2xl font-bold">{profile.displayName}</h2>
                        <p className="text-muted-foreground">Membre de SimuBourse</p>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Fil d'Activité</CardTitle>
                        <CardDescription>Transactions publiques récentes de l'utilisateur.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Actif</TableHead>
                                    <TableHead>Valeur</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {profile.transactions.length > 0 ? (
                                    profile.transactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>
                                                <Badge variant={tx.type === 'Buy' ? 'destructive' : 'default'} className={tx.type === 'Sell' ? 'bg-green-600' : ''}>
                                                    {tx.type === 'Buy' ? 'Achat' : 'Vente'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{tx.name}</div>
                                                <div className="text-sm text-muted-foreground">{tx.ticker}</div>
                                            </TableCell>
                                            <TableCell className={tx.type === 'Buy' ? 'text-red-500' : 'text-green-500'}>
                                                {tx.type === 'Buy' ? '-' : '+'}${tx.value.toFixed(2)}
                                            </TableCell>
                                            <TableCell>{format(new Date(tx.createdAt), 'd MMM, HH:mm', { locale: fr })}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            Cet utilisateur n'a pas encore de transactions publiques.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
