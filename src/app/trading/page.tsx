import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TradingPage() {
  const assets = [
    { name: 'Apple Inc.', ticker: 'AAPL', price: '$207.69', change: '+1.24%', marketCap: '$3.18T', type: 'Stock' },
    { name: 'Microsoft Corp.', ticker: 'MSFT', price: '$442.57', change: '+0.92%', marketCap: '$3.29T', type: 'Stock' },
    { name: 'Amazon.com, Inc.', ticker: 'AMZN', price: '$183.63', change: '-0.10%', marketCap: '$1.91T', type: 'Stock' },
    { name: 'Bitcoin', ticker: 'BTC', price: '$67,120.50', change: '+2.10%', marketCap: '$1.32T', type: 'Crypto' },
    { name: 'Ethereum', ticker: 'ETH', price: '$3,450.78', change: '-1.50%', marketCap: '$414.5B', type: 'Crypto' },
    { name: 'Gold Spot', ticker: 'XAU/USD', price: '$2,320.50', change: '+0.50%', marketCap: '$15.8T', type: 'Commodity' },
    { name: 'EUR/USD', ticker: 'EURUSD', price: '1.0712', change: '-0.21%', marketCap: 'N/A', type: 'Forex' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Virtual Trading Floor</CardTitle>
        <CardDescription>Buy and sell assets with virtual currency using real-time market data.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Change (24h)</TableHead>
              <TableHead>Market Cap</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.ticker}>
                <TableCell>
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-sm text-muted-foreground">{asset.ticker}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{asset.type}</Badge>
                </TableCell>
                <TableCell className="font-mono">{asset.price}</TableCell>
                <TableCell className={asset.change.startsWith('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                  {asset.change}
                </TableCell>
                <TableCell>{asset.marketCap}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm">Buy</Button>
                  <Button variant="secondary" size="sm">Sell</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
