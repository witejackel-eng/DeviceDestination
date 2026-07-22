import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial-page";
export const metadata: Metadata = { title: "Installation policy" };
export default function InstallationPage() {
  return (
    <EditorialPage
      eyebrow="Policy"
      title="Installation policy"
      intro="Hardware purchase and site installation are separate scopes."
      sections={[
        {
          title: "Third-party installers",
          body: (
            <p>
              Installation may be provided through qualified third-party installers. It is not
              represented as DeviceDestination’s in-house service.
            </p>
          ),
        },
        {
          title: "Site assessment",
          body: (
            <p>
              Cable routes, heights, drilling, power, network, civil work and access conditions must
              be assessed before a final installation price.
            </p>
          ),
        },
        {
          title: "Customer responsibilities",
          body: (
            <p>
              Provide safe access, necessary permissions, stable power/network and accurate site
              information. Concealed conditions may change the scope.
            </p>
          ),
        },
        {
          title: "Sign-off",
          body: (
            <p>
              Test camera views, recording, remote access and attendance/access workflows with the
              installer before signing off the work.
            </p>
          ),
        },
      ]}
    />
  );
}
