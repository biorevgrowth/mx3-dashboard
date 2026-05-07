// Smart greeting helper — picks "Hey {first_name}", "Hey {contact_first_name}",
// or "Re: {full_name}" based on whether the customer name looks like a person
// or an organization.
//
// Examples:
//   "Wayne State University"           -> "Re: Wayne State University"
//   "Houston Dynamo FC"                -> "Re: Houston Dynamo FC"
//   "Cupertino Electric, Inc."         -> "Re: Cupertino Electric, Inc."
//   "Logan Aitken"                     -> "Hey Logan"
//   "Clean Harbors Inc - Justin Garrard" -> "Hey Justin"
//   "Brown & Root Industrial Services - Tommy Surles" -> "Hey Tommy"

const ORG_TOKENS = /\b(university|college|institute|inc|llc|ltd|corp|corporation|fc|fc\.|company|companies|industries|industrial|drilling|services|service|center|centre|group|health|medicine|diagnostics|logistics|supply|materials|manufacturing|solutions|systems|hardware|equipment|salt|electric|partners|brothers|sons|teknical|safety|root)\b\.?/i;

function isOrg(s) { return s && ORG_TOKENS.test(s); }
function firstWord(s) { return (s || '').trim().split(/\s+/)[0]; }

export function smartGreeting(customerName) {
  if (!customerName) return 'Hey there';
  // "Org Name - Contact Name" pattern: extract contact, use first name if it looks personal
  const dashSplit = customerName.split(/\s+-\s+/);
  if (dashSplit.length > 1) {
    const contact = dashSplit[dashSplit.length - 1].trim();
    if (!isOrg(contact) && contact.split(/\s+/).length <= 3) {
      return `Hey ${firstWord(contact)}`;
    }
  }
  // Whole name looks like an org -> use Re: prefix
  if (isOrg(customerName)) return `Re: ${customerName}`;
  // Otherwise treat as personal name
  return `Hey ${firstWord(customerName)}`;
}
