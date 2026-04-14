const groups = [
  {
    name: "web",
    required: [
      "NEXT_PUBLIC_SUPABASE_URL",
      ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    ]
  },
  {
    name: "mobile",
    required: [
      "EXPO_PUBLIC_SUPABASE_URL",
      ["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]
    ]
  },
  {
    name: "supabase",
    required: [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CRON_SECRET"
    ]
  }
];

const isFilled = (value) => typeof value === "string" && value.trim().length > 0;

const readValue = (name) => process.env[name];

const results = groups.map((group) => {
  const missing = [];
  const satisfied = [];

  for (const requirement of group.required) {
    if (Array.isArray(requirement)) {
      const present = requirement.filter((name) => isFilled(readValue(name)));

      if (present.length > 0) {
        satisfied.push(present[0]);
      } else {
        missing.push(requirement.join(" or "));
      }
      continue;
    }

    if (isFilled(readValue(requirement))) {
      satisfied.push(requirement);
    } else {
      missing.push(requirement);
    }
  }

  return {
    ...group,
    missing,
    satisfied
  };
});

const allMissing = results.flatMap((group) =>
  group.missing.map((name) => `${group.name}: ${name}`)
);

const totalRequired = results.reduce((sum, group) => sum + group.required.length, 0);
const totalSatisfied = results.reduce((sum, group) => sum + group.satisfied.length, 0);

console.log("Runtime env check");
console.log(`- groups: ${results.length}`);
console.log(`- satisfied: ${totalSatisfied}/${totalRequired}`);

for (const group of results) {
  console.log(`\n[${group.name}]`);
  if (group.satisfied.length > 0) {
    console.log(`  ok: ${group.satisfied.join(", ")}`);
  }
  if (group.missing.length > 0) {
    console.log(`  missing: ${group.missing.join(", ")}`);
  }
}

if (allMissing.length > 0) {
  console.error("\nMissing required runtime env variables:");
  for (const item of allMissing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("\nAll required runtime env variables are present.");
