import { use } from "react";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default function ProjectPage({ params }: Props) {
  const { id } = use(params);
  redirect(`/dashboard/projects/${id}/studio`);
}
