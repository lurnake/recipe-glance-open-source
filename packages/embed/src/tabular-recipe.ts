import { validateRecipeDocument } from "@recipe-glance/schema";
import { renderRecipe, isThemeId, type ThemeId } from "@recipe-glance/renderer";

/**
 * <recipe-glance theme="basic">
 *   { ...rgf json... }
 * </recipe-glance>
 *
 * Or: <recipe-glance src="/path/to/recipe.json" theme="basic"></recipe-glance>
 */
export class RecipeGlanceElement extends HTMLElement {
  static get observedAttributes() {
    return ["theme", "src", "force-card"];
  }

  connectedCallback() {
    void this.render();
  }

  attributeChangedCallback() {
    void this.render();
  }

  private async render() {
    const themeAttr = this.getAttribute("theme") ?? "basic";
    const theme: ThemeId = isThemeId(themeAttr) ? themeAttr : "basic";
    const forceCard = this.hasAttribute("force-card");

    let raw: unknown;
    const src = this.getAttribute("src");
    if (src) {
      const res = await fetch(src);
      raw = await res.json();
    } else {
      const text = this.textContent?.trim() ?? "";
      if (!text) {
        this.innerHTML = "";
        return;
      }
      try {
        raw = JSON.parse(text);
      } catch {
        this.innerHTML = `<p style="color:red">Invalid JSON in recipe-glance</p>`;
        return;
      }
    }

    const validated = validateRecipeDocument(raw);
    if (!validated.ok) {
      this.innerHTML = `<p style="color:red">Invalid RGF: ${validated.issues[0]?.message ?? "error"}</p>`;
      return;
    }

    const { html } = renderRecipe(validated.document, {
      theme,
      forceCard,
      includeStyles: true,
    });
    // Shadow DOM isolation for embeds
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    shadow.innerHTML = html;
  }
}

if (
  typeof customElements !== "undefined" &&
  !customElements.get("recipe-glance")
) {
  customElements.define("recipe-glance", RecipeGlanceElement);
}

export default RecipeGlanceElement;
