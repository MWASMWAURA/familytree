// Date formatting utility functions
export const formatDate = (date: Date | string, formatString = "PPP"): string => {
  if (!date) return "";
  const d = new Date(date);
  if (formatString === "PPP") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (formatString === "yyyy-MM-dd") {
    return d.toISOString().split("T")[0];
  }
  if (formatString === "MMM dd, yyyy") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  if (formatString === "MMMM dd, yyyy") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return d.toLocaleDateString();
};
