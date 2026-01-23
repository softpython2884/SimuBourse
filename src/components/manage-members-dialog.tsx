'use client';

import { useState, useTransition } from 'react';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Trash2, UserPlus } from 'lucide-react';
import { CompanyWithDetails, searchUsersForCompany, addMemberToCompany, removeMemberFromCompany } from '@/lib/actions/companies';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';

interface ManageMembersDialogProps {
  company: CompanyWithDetails;
  children: React.ReactNode;
}

type SearchResultUser = {
    id: number;
    displayName: string;
    email: string;
}

function getInitials(name: string) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export function ManageMembersDialog({ company, children }: ManageMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      toast({ variant: 'destructive', title: 'Invalid Search', description: 'Please enter at least 2 characters.' });
      return;
    }
    setIsSearching(true);
    const users = await searchUsersForCompany(company.id, searchQuery);
    setSearchResults(users);
    setIsSearching(false);
  };

  const handleAddMember = (userId: number, role: 'member' | 'manager') => {
    startTransition(async () => {
      const result = await addMemberToCompany(company.id, userId, role);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: 'Success', description: result.success });
        setSearchQuery('');
        setSearchResults([]);
        setOpen(false); // Close dialog on success
      }
    });
  };

  const handleRemoveMember = (memberId: number) => {
    startTransition(async () => {
      const result = await removeMemberFromCompany(company.id, memberId);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: 'Success', description: result.success });
        setOpen(false); // Close dialog on success
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Members of {company.name}</DialogTitle>
          <DialogDescription>Add or remove members from your company.</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <h3 className="mb-4 text-lg font-medium">Current Members</h3>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-4">
            {company.members.map(member => (
              <div key={member.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(member.user.displayName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{member.user.displayName}</p>
                    <Badge variant="secondary">{member.role.toUpperCase()}</Badge>
                  </div>
                </div>
                {member.role !== 'ceo' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={isPending}
                    aria-label="Remove member"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t pt-6">
            <h3 className="mb-4 text-lg font-medium">Add New Member</h3>
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching || searchQuery.length < 2}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                </Button>
            </div>

            {searchResults.length > 0 && (
                 <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                    {searchResults.map(user => (
                        <AddMemberRow key={user.id} user={user} onAdd={handleAddMember} isPending={isPending} />
                    ))}
                 </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberRow({ user, onAdd, isPending }: { user: SearchResultUser, onAdd: (userId: number, role: 'member' | 'manager') => void, isPending: boolean }) {
    const [role, setRole] = useState<'member' | 'manager'>('member');

    return (
        <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
                 <Avatar>
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                <div>
                    <p className="font-semibold">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Select value={role} onValueChange={(value: 'member' | 'manager') => setRole(value)}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                </Select>
                 <Button size="sm" onClick={() => onAdd(user.id, role)} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4"/>}
                 </Button>
            </div>
        </div>
    );
}
