// ┌───────────────────────────────────────────────┐
// │  Liquid Glass — Shared GLSL shader functions   │
// │  Pure JS module. No DOM or browser APIs.       │
// └───────────────────────────────────────────────┘

const ROUNDED_RECT_GLSL = /* glsl */ `
  float roundedRectDistance(vec2 coord, vec2 size, float radius) {
    vec2 center = size * 0.5;
    vec2 pixelCoord = coord * size;
    vec2 toCorner = abs(pixelCoord - center) - (center - radius);
    float outsideCorner = length(max(toCorner, 0.0));
    float insideCorner = min(max(toCorner.x, toCorner.y), 0.0);
    return (outsideCorner + insideCorner - radius);
  }
`

const CIRCLE_GLSL = /* glsl */ `
  float circleDistance(vec2 coord, vec2 size, float radius) {
    vec2 center = vec2(0.5, 0.5);
    vec2 pixelCoord = coord * size;
    vec2 centerPixel = center * size;
    float distFromCenter = length(pixelCoord - centerPixel);
    return distFromCenter - radius;
  }
`

const PILL_GLSL = /* glsl */ `
  float pillDistance(vec2 coord, vec2 size, float radius) {
    vec2 center = size * 0.5;
    vec2 pixelCoord = coord * size;
    vec2 capsuleStart = vec2(radius, center.y);
    vec2 capsuleEnd = vec2(size.x - radius, center.y);
    vec2 capsuleAxis = capsuleEnd - capsuleStart;
    float capsuleLength = length(capsuleAxis);
    if (capsuleLength > 0.0) {
      vec2 toPoint = pixelCoord - capsuleStart;
      float t = clamp(dot(toPoint, capsuleAxis) / dot(capsuleAxis, capsuleAxis), 0.0, 1.0);
      vec2 closestPointOnAxis = capsuleStart + t * capsuleAxis;
      return length(pixelCoord - closestPointOnAxis) - radius;
    } else {
      return length(pixelCoord - center) - radius;
    }
  }
`

const SHAPE_DETECT_GLSL = /* glsl */ `
  bool isPill(vec2 size, float radius) {
    float heightRatioDiff = abs(radius - size.y * 0.5);
    bool radiusMatchesHeight = heightRatioDiff < 2.0;
    bool isWiderThanTall = size.x > size.y + 4.0;
    return radiusMatchesHeight && isWiderThanTall;
  }
  bool isCircle(vec2 size, float radius) {
    float minDim = min(size.x, size.y);
    bool radiusMatchesMinDim = abs(radius - minDim * 0.5) < 1.0;
    bool isRoughlySquare = abs(size.x - size.y) < 4.0;
    return radiusMatchesMinDim && isRoughlySquare;
  }
`

export function buildContainerShader() {
  const vsSource = /* glsl */ `
    attribute vec2 a_position;
    attribute vec2 a_texcoord;
    varying vec2 v_texcoord;
    void main() {
      gl_Position = vec4(a_position, 0, 1);
      v_texcoord = a_texcoord;
    }
  `

  const fsSource = /* glsl */ `
    precision mediump float;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform vec2 u_textureSize;
    uniform float u_scrollY;
    uniform float u_pageHeight;
    uniform float u_viewportHeight;
    uniform float u_blurRadius;
    uniform float u_borderRadius;
    uniform vec2 u_containerPosition;
    uniform float u_warp;
    uniform float u_edgeIntensity;
    uniform float u_rimIntensity;
    uniform float u_baseIntensity;
    uniform float u_edgeDistance;
    uniform float u_rimDistance;
    uniform float u_baseDistance;
    uniform float u_cornerBoost;
    uniform float u_rippleEffect;
    uniform float u_tintOpacity;
    varying vec2 v_texcoord;

    ${ROUNDED_RECT_GLSL}
    ${CIRCLE_GLSL}
    ${PILL_GLSL}
    ${SHAPE_DETECT_GLSL}

    void main() {
      vec2 coord = v_texcoord;
      float scrollY = u_scrollY;
      vec2 containerSize = u_resolution;
      vec2 textureSize = u_textureSize;
      vec2 containerCenter = u_containerPosition + vec2(0.0, scrollY);
      vec2 containerOffset = (coord - 0.5) * containerSize;
      vec2 pagePixel = containerCenter + containerOffset;
      vec2 textureCoord = pagePixel / textureSize;

      float distFromEdgeShape;
      vec2 shapeNormal;

      if (isPill(u_resolution, u_borderRadius)) {
        distFromEdgeShape = -pillDistance(coord, u_resolution, u_borderRadius);
        vec2 center = vec2(0.5, 0.5);
        vec2 pixelCoord = coord * u_resolution;
        vec2 capsuleStart = vec2(u_borderRadius, center.y * u_resolution.y);
        vec2 capsuleEnd = vec2(u_resolution.x - u_borderRadius, center.y * u_resolution.y);
        vec2 capsuleAxis = capsuleEnd - capsuleStart;
        float capsuleLength = length(capsuleAxis);
        if (capsuleLength > 0.0) {
          vec2 toPoint = pixelCoord - capsuleStart;
          float t = clamp(dot(toPoint, capsuleAxis) / dot(capsuleAxis, capsuleAxis), 0.0, 1.0);
          vec2 closestPointOnAxis = capsuleStart + t * capsuleAxis;
          vec2 normalDir = pixelCoord - closestPointOnAxis;
          shapeNormal = length(normalDir) > 0.0 ? normalize(normalDir) : vec2(0.0, 1.0);
        } else {
          shapeNormal = normalize(coord - center);
        }
      } else if (isCircle(u_resolution, u_borderRadius)) {
        distFromEdgeShape = -circleDistance(coord, u_resolution, u_borderRadius);
        vec2 center = vec2(0.5, 0.5);
        shapeNormal = normalize(coord - center);
      } else {
        distFromEdgeShape = -roundedRectDistance(coord, u_resolution, u_borderRadius);
        vec2 center = vec2(0.5, 0.5);
        shapeNormal = normalize(coord - center);
      }
      distFromEdgeShape = max(distFromEdgeShape, 0.0);

      float distFromLeft = coord.x;
      float distFromRight = 1.0 - coord.x;
      float distFromTop = coord.y;
      float distFromBottom = 1.0 - coord.y;
      float distFromEdge = distFromEdgeShape / min(u_resolution.x, u_resolution.y);
      float normalizedDistance = distFromEdge * min(u_resolution.x, u_resolution.y);
      float baseIntensity = 1.0 - exp(-normalizedDistance * u_baseDistance);
      float edgeIntensity = exp(-normalizedDistance * u_edgeDistance);
      float rimIntensity = exp(-normalizedDistance * u_rimDistance);

      float baseComponent = u_warp > 0.5 ? baseIntensity * u_baseIntensity : 0.0;
      float totalIntensity = baseComponent + edgeIntensity * u_edgeIntensity + rimIntensity * u_rimIntensity;
      vec2 baseRefraction = shapeNormal * totalIntensity;

      float cornerProximityX = min(distFromLeft, distFromRight);
      float cornerProximityY = min(distFromTop, distFromBottom);
      float cornerDistance = max(cornerProximityX, cornerProximityY);
      float cornerNormalized = cornerDistance * min(u_resolution.x, u_resolution.y);
      float cornerBoost = exp(-cornerNormalized * 0.3) * u_cornerBoost;
      vec2 cornerRefraction = shapeNormal * cornerBoost;

      vec2 perpendicular = vec2(-shapeNormal.y, shapeNormal.x);
      float rippleEffect = sin(distFromEdge * 25.0) * u_rippleEffect * rimIntensity;
      vec2 textureRefraction = perpendicular * rippleEffect;
      vec2 totalRefraction = baseRefraction + cornerRefraction + textureRefraction;
      textureCoord += totalRefraction;

      vec4 color = vec4(0.0);
      vec2 texelSize = 1.0 / u_textureSize;
      float sigma = u_blurRadius / 2.0;
      vec2 blurStep = texelSize * sigma;
      float totalWeight = 0.0;
      for (float i = -6.0; i <= 6.0; i += 1.0) {
        for (float j = -6.0; j <= 6.0; j += 1.0) {
          float distance = length(vec2(i, j));
          if (distance > 6.0) continue;
          float weight = exp(-(distance * distance) / (2.0 * sigma * sigma));
          vec2 offset = vec2(i, j) * blurStep;
          color += texture2D(u_image, textureCoord + offset) * weight;
          totalWeight += weight;
        }
      }
      color /= totalWeight;

      float gradientPosition = coord.y;
      vec3 topTint = vec3(1.0, 1.0, 1.0);
      vec3 bottomTint = vec3(0.7, 0.7, 0.7);
      vec3 gradientTint_ = mix(topTint, bottomTint, gradientPosition);
      vec3 tintedColor = mix(color.rgb, gradientTint_, u_tintOpacity);
      color = vec4(tintedColor, color.a);

      vec2 viewportCenter = containerCenter;
      float topY = (viewportCenter.y - containerSize.y * 0.4) / textureSize.y;
      float midY = viewportCenter.y / textureSize.y;
      float bottomY = (viewportCenter.y + containerSize.y * 0.4) / textureSize.y;
      vec3 topColor = vec3(0.0);
      vec3 midColor = vec3(0.0);
      vec3 bottomColor = vec3(0.0);
      float sampleCount = 0.0;
      for (float x = 0.0; x < 1.0; x += 0.05) {
        for (float yOffset = -5.0; yOffset <= 5.0; yOffset += 1.0) {
          vec2 topSample = vec2(x, topY + yOffset * texelSize.y);
          vec2 midSample = vec2(x, midY + yOffset * texelSize.y);
          vec2 bottomSample = vec2(x, bottomY + yOffset * texelSize.y);
          topColor += texture2D(u_image, topSample).rgb;
          midColor += texture2D(u_image, midSample).rgb;
          bottomColor += texture2D(u_image, bottomSample).rgb;
          sampleCount += 1.0;
        }
      }
      topColor /= sampleCount;
      midColor /= sampleCount;
      bottomColor /= sampleCount;
      vec3 sampledGradient;
      if (gradientPosition < 0.1) {
        sampledGradient = topColor;
      } else if (gradientPosition > 0.9) {
        sampledGradient = bottomColor;
      } else {
        float transitionPos = (gradientPosition - 0.1) / 0.8;
        if (transitionPos < 0.5) {
          float t = transitionPos * 2.0;
          sampledGradient = mix(topColor, midColor, t);
        } else {
          float t = (transitionPos - 0.5) * 2.0;
          sampledGradient = mix(midColor, bottomColor, t);
        }
      }
      vec3 finalTinted = mix(color.rgb, sampledGradient, u_tintOpacity * 0.3);
      color = vec4(finalTinted, color.a);

      float maskDistance;
      if (isPill(u_resolution, u_borderRadius)) {
        maskDistance = pillDistance(coord, u_resolution, u_borderRadius);
      } else if (isCircle(u_resolution, u_borderRadius)) {
        maskDistance = circleDistance(coord, u_resolution, u_borderRadius);
      } else {
        maskDistance = roundedRectDistance(coord, u_resolution, u_borderRadius);
      }
      float mask = 1.0 - smoothstep(-1.0, 1.0, maskDistance);
      gl_FragColor = vec4(color.rgb, mask);
    }
  `

  return { vsSource, fsSource }
}

export function buildNestedShader() {
  const vsSource = /* glsl */ `
    attribute vec2 a_position;
    attribute vec2 a_texcoord;
    varying vec2 v_texcoord;
    void main() {
      gl_Position = vec4(a_position, 0, 1);
      v_texcoord = a_texcoord;
    }
  `

  const fsSource = /* glsl */ `
    precision mediump float;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform vec2 u_textureSize;
    uniform float u_blurRadius;
    uniform float u_borderRadius;
    uniform vec2 u_buttonPosition;
    uniform vec2 u_containerPosition;
    uniform vec2 u_containerSize;
    uniform float u_warp;
    uniform float u_edgeIntensity;
    uniform float u_rimIntensity;
    uniform float u_baseIntensity;
    uniform float u_edgeDistance;
    uniform float u_rimDistance;
    uniform float u_baseDistance;
    uniform float u_cornerBoost;
    uniform float u_rippleEffect;
    uniform float u_tintOpacity;
    varying vec2 v_texcoord;

    ${ROUNDED_RECT_GLSL}
    ${CIRCLE_GLSL}
    ${PILL_GLSL}
    ${SHAPE_DETECT_GLSL}

    void main() {
      vec2 coord = v_texcoord;
      vec2 buttonSize = u_resolution;
      vec2 containerSize = u_containerSize;
      vec2 containerTopLeft = u_containerPosition - containerSize * 0.5;
      vec2 buttonTopLeft = u_buttonPosition - buttonSize * 0.5;
      vec2 buttonRelativePos = buttonTopLeft - containerTopLeft;
      vec2 buttonPixel = coord * buttonSize;
      vec2 containerPixel = buttonRelativePos + buttonPixel;
      vec2 baseTextureCoord = containerPixel / containerSize;

      float distFromEdgeShape;
      vec2 shapeNormal;
      if (isPill(u_resolution, u_borderRadius)) {
        distFromEdgeShape = -pillDistance(coord, u_resolution, u_borderRadius);
        vec2 center = vec2(0.5, 0.5);
        vec2 pixelCoord = coord * u_resolution;
        vec2 capsuleStart = vec2(u_borderRadius, center.y * u_resolution.y);
        vec2 capsuleEnd = vec2(u_resolution.x - u_borderRadius, center.y * u_resolution.y);
        vec2 capsuleAxis = capsuleEnd - capsuleStart;
        float capsuleLength = length(capsuleAxis);
        if (capsuleLength > 0.0) {
          vec2 toPoint = pixelCoord - capsuleStart;
          float t = clamp(dot(toPoint, capsuleAxis) / dot(capsuleAxis, capsuleAxis), 0.0, 1.0);
          vec2 closestPointOnAxis = capsuleStart + t * capsuleAxis;
          vec2 normalDir = pixelCoord - closestPointOnAxis;
          shapeNormal = length(normalDir) > 0.0 ? normalize(normalDir) : vec2(0.0, 1.0);
        } else {
          shapeNormal = normalize(coord - center);
        }
      } else if (isCircle(u_resolution, u_borderRadius)) {
        distFromEdgeShape = -circleDistance(coord, u_resolution, u_borderRadius);
        vec2 center = vec2(0.5, 0.5);
        shapeNormal = normalize(coord - center);
      } else {
        distFromEdgeShape = -roundedRectDistance(coord, u_resolution, u_borderRadius);
        vec2 center = vec2(0.5, 0.5);
        shapeNormal = normalize(coord - center);
      }
      distFromEdgeShape = max(distFromEdgeShape, 0.0);

      float distFromLeft = coord.x;
      float distFromRight = 1.0 - coord.x;
      float distFromTop = coord.y;
      float distFromBottom = 1.0 - coord.y;
      float distFromEdge = distFromEdgeShape / min(u_resolution.x, u_resolution.y);
      float normalizedDistance = distFromEdge * min(u_resolution.x, u_resolution.y);
      float baseIntensity = 1.0 - exp(-normalizedDistance * u_baseDistance);
      float edgeIntensity = exp(-normalizedDistance * u_edgeDistance);
      float rimIntensity = exp(-normalizedDistance * u_rimDistance);
      float baseComponent = u_warp > 0.5 ? baseIntensity * u_baseIntensity : 0.0;
      float totalIntensity = baseComponent + edgeIntensity * u_edgeIntensity + rimIntensity * u_rimIntensity;
      vec2 baseRefraction = shapeNormal * totalIntensity;

      float cornerProximityX = min(distFromLeft, distFromRight);
      float cornerProximityY = min(distFromTop, distFromBottom);
      float cornerDistance = max(cornerProximityX, cornerProximityY);
      float cornerNormalized = cornerDistance * min(u_resolution.x, u_resolution.y);
      float cornerBoost = exp(-cornerNormalized * 0.3) * u_cornerBoost;
      vec2 cornerRefraction = shapeNormal * cornerBoost;

      vec2 perpendicular = vec2(-shapeNormal.y, shapeNormal.x);
      float rippleEffect = sin(distFromEdge * 30.0) * u_rippleEffect * rimIntensity;
      vec2 textureRefraction = perpendicular * rippleEffect;
      vec2 totalRefraction = baseRefraction + cornerRefraction + textureRefraction;
      vec2 textureCoord = baseTextureCoord + totalRefraction;

      vec4 color = vec4(0.0);
      vec2 texelSize = 1.0 / containerSize;
      float sigma = u_blurRadius / 3.0;
      vec2 blurStep = texelSize * sigma;
      float totalWeight = 0.0;
      for (float i = -4.0; i <= 4.0; i += 1.0) {
        for (float j = -4.0; j <= 4.0; j += 1.0) {
          float distance = length(vec2(i, j));
          if (distance > 4.0) continue;
          float weight = exp(-(distance * distance) / (2.0 * sigma * sigma));
          vec2 offset = vec2(i, j) * blurStep;
          color += texture2D(u_image, textureCoord + offset) * weight;
          totalWeight += weight;
        }
      }
      color /= totalWeight;

      float gradientPosition = coord.y;
      vec3 topTint = vec3(1.0, 1.0, 1.0);
      vec3 bottomTint = vec3(0.7, 0.7, 0.7);
      vec3 gradientTint_ = mix(topTint, bottomTint, gradientPosition);
      vec3 tintedColor = mix(color.rgb, gradientTint_, u_tintOpacity * 0.7);
      color = vec4(tintedColor, color.a);

      vec2 viewportCenter = u_buttonPosition;
      float topY = max(0.0, (viewportCenter.y - buttonSize.y * 0.4) / containerSize.y);
      float midY = viewportCenter.y / containerSize.y;
      float bottomY = min(1.0, (viewportCenter.y + buttonSize.y * 0.4) / containerSize.y);

      vec3 topColor = texture2D(u_image, vec2(0.5, topY)).rgb;
      vec3 midColor = texture2D(u_image, vec2(0.5, midY)).rgb;
      vec3 bottomColor = texture2D(u_image, vec2(0.5, bottomY)).rgb;
      vec3 sampledGradient;
      if (gradientPosition < 0.1) {
        sampledGradient = topColor;
      } else if (gradientPosition > 0.9) {
        sampledGradient = bottomColor;
      } else {
        float transitionPos = (gradientPosition - 0.1) / 0.8;
        if (transitionPos < 0.5) {
          float t = transitionPos * 2.0;
          sampledGradient = mix(topColor, midColor, t);
        } else {
          float t = (transitionPos - 0.5) * 2.0;
          sampledGradient = mix(midColor, bottomColor, t);
        }
      }
      vec3 secondTinted = mix(color.rgb, sampledGradient, u_tintOpacity * 0.4);
      vec3 buttonTopTint = vec3(1.08, 1.08, 1.08);
      vec3 buttonBottomTint = vec3(0.92, 0.92, 0.92);
      vec3 buttonGradient = mix(buttonTopTint, buttonBottomTint, gradientPosition);
      vec3 finalTinted = secondTinted * buttonGradient;

      float maskDistance;
      if (isPill(u_resolution, u_borderRadius)) {
        maskDistance = pillDistance(coord, u_resolution, u_borderRadius);
      } else if (isCircle(u_resolution, u_borderRadius)) {
        maskDistance = circleDistance(coord, u_resolution, u_borderRadius);
      } else {
        maskDistance = roundedRectDistance(coord, u_resolution, u_borderRadius);
      }
      float mask = 1.0 - smoothstep(-1.0, 1.0, maskDistance);
      gl_FragColor = vec4(finalTinted, mask);
    }
  `

  return { vsSource, fsSource }
}
