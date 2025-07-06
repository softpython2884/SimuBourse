'use client';

import { useEffect, useState } from 'react';
// import { db } from '@/lib/firebase'; // Remplacé
// import { doc, getDoc, collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore'; // Remplacé
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from 'lucide-react';

interface PublicUserProfile {
  displayName: string;
  email: string;
}

interface PublicTransaction {
  type: 'Buy' | 'Sell';
  asset: { name: string, ticker: string };
  quantity: number;
  value: number;
  date: string;
}

export default function PublicProfilePage({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [transactions, setTransactions] = useState<PublicTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
        setError("Aucun ID d'utilisateur fourni.");
        setLoading(false);
        return;
    };

    const fetchProfileData = async () => {
      setLoading(true);
      setError(null);
      // La logique de récupération des données sera ré-implémentée avec PostgreSQL.
      // Pour l'instant, on affiche un état d'erreur car la fonctionnalité n'est pas encore migrée.
      setError("La consultation des profils publics est temporairement désactivée pendant la migration de la base de données.");
      setLoading(false);
    };

    fetchProfileData();
  }, [userId]);

  const getInitials = (displayName: string | undefined) => {
    if (!displayName) return '?';
    return displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Profil Public</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center text-center">
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
                            {transactions.length > 0 ? (
                                transactions.map((tx, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <Badge variant={tx.type === 'Buy' ? 'default' : 'secondary'} className={tx.type === 'Buy' ? 'bg-red-600' : 'bg-green-600'}>
                                                {tx.type === 'Buy' ? 'Achat' : 'Vente'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{tx.asset.name}</TableCell>
                                        <TableCell className={tx.type === 'Buy' ? 'text-red-500' : 'text-green-500'}>
                                            {tx.type === 'Buy' ? '-' : '+'}${tx.value.toFixed(2)}
                                        </TableCell>
                                        <TableCell>{tx.date}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        Cet utilisateur n'a pas encore de transactions.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
