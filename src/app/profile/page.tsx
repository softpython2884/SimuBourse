import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const transactions = [
  { type: 'Buy', asset: 'TSLA', amount: '10 shares', value: '$1,774.60', date: '2024-07-20' },
  { type: 'Sell', asset: 'ETH', amount: '0.5 ETH', value: '$1,725.39', date: '2024-07-19' },
  { type: 'Win', asset: 'Prediction', amount: 'World Cup Bet', value: '$500.00', date: '2024-07-18' },
  { type: 'Reward', asset: 'Mining', amount: '0.001 BTC', value: '$67.12', date: '2024-07-17' },
];

export default function ProfilePage() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src="https://placehold.co/100x100.png" alt="@username" data-ai-hint="person avatar" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold">Username</h2>
            <p className="text-muted-foreground">Joined July 2024</p>
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex justify-between">
              <span className="text-muted-foreground">Total Portfolio Value</span>
              <span className="font-bold">$45,231.89</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Gains</span>
              <span className="font-bold text-green-500 dark:text-green-400">+$8,123.45</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prediction Win Rate</span>
              <span className="font-bold">68%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>A log of all your recent trading and betting activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Asset/Details</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant={tx.type === 'Buy' || tx.type === 'Sell' ? 'default' : 'secondary'}>
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{tx.asset}</TableCell>
                    <TableCell>{tx.amount}</TableCell>
                    <TableCell className={tx.type === 'Buy' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}>
                      {tx.type === 'Buy' ? '-' : '+'}{tx.value}
                    </TableCell>
                    <TableCell>{tx.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
