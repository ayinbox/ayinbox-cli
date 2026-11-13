# syntax=docker/dockerfile:1
# The ayinbox CLI as a small image, built from a released binary checked
# against the release's checksums.txt. Nothing is compiled here.
#
#   docker build --build-arg VERSION=v1.2.3 \
#     --build-arg SHA256_AMD64=<sum> --build-arg SHA256_ARM64=<sum> .
FROM alpine:3.23 AS fetch

ARG TARGETARCH
ARG VERSION
ARG SHA256_AMD64
ARG SHA256_ARM64

WORKDIR /tmp/ayinbox
# The checksum is pinned at build time, so a changed asset fails the build.
RUN set -eu; \
    test -n "${VERSION:-}" || { echo "VERSION is required" >&2; exit 1; }; \
    case "$TARGETARCH" in \
      amd64) sum="${SHA256_AMD64:-}" ;; \
      arm64) sum="${SHA256_ARM64:-}" ;; \
      *) echo "no ayinbox build for $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    test -n "$sum" || { echo "SHA256_${TARGETARCH} is required" >&2; exit 1; }; \
    asset="ayinbox_linux_${TARGETARCH}.tar.gz"; \
    wget -q -O "$asset" "https://github.com/ayinbox/ayinbox-cli/releases/download/${VERSION}/${asset}"; \
    echo "$sum  $asset" | sha256sum -c -; \
    tar -xzf "$asset"; \
    test -x ayinbox

FROM alpine:3.23

RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 1000 ayinbox

COPY --from=fetch /tmp/ayinbox/ayinbox /usr/local/bin/ayinbox
COPY --from=fetch /tmp/ayinbox/LICENSE /usr/share/doc/ayinbox/LICENSE

# No browser in a container, so AYINBOX_TOKEN is the way in.
ENV AYINBOX_CONFIG_DIR=/home/ayinbox/.config/ayinbox \
    AYINBOX_NO_UPDATE_CHECK=1

USER ayinbox
WORKDIR /home/ayinbox

ENTRYPOINT ["ayinbox"]
CMD ["--help"]
