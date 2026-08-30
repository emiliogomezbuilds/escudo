import { verifyFamilyContact, deleteFamilyContact } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Contact = {
  id: string;
  name: string;
  phone_e164: string;
  verified: boolean;
};

export function FamilyContactList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no has agregado ningún contacto familiar.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {contacts.map((contact) => (
        <li
          key={contact.id}
          className="flex items-center justify-between gap-3 rounded-md border p-3"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{contact.name}</span>
              {contact.verified ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Verificado
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  Verificación pendiente
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {contact.phone_e164}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!contact.verified && (
              <form action={verifyFamilyContact.bind(null, contact.id)}>
                <Button type="submit" size="sm" variant="outline">
                  Confirmar número
                </Button>
              </form>
            )}
            <form action={deleteFamilyContact.bind(null, contact.id)}>
              <Button type="submit" size="sm" variant="ghost">
                Eliminar
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
