// TODO: Since these are not global, let's move these locally to the right mdx
import VectorAdd from "./visualizations/VectorAdd.astro";
import VectorSub from "./visualizations/VectorSub.astro";
import VectorScale from "./visualizations/VectorScale.astro";

import ImageAsset from "./ImageAsset.astro";
import MetaList from "./MetaList.astro";
import MetaItem from "./MetaItem.astro";

export const components = {
    VectorScale,
    VectorSub,
    VectorAdd,
    MetaList,
    MetaItem,
    ImageAsset
};
